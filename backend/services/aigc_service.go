package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"invite-backend/config"
)

type AIGCResult struct {
	Score        int    `json:"score"`
	Confidence   string `json:"confidence"`
	Evidence     string `json:"evidence"`
	Analysis     string `json:"analysis"`
	Relevance    int    `json:"relevance"`
	Authenticity int    `json:"authenticity"`
	Completeness int    `json:"completeness"`
	Expression   int    `json:"expression"`
	Reply        string `json:"reply"`
}

func AnalyzeAIGC(content string) (*AIGCResult, error) {
	settings, err := GetSystemSettings()
	if err != nil {
		return nil, fmt.Errorf("failed to get system settings: %v", err)
	}

	apiKey := settings["llm_api_key"]
	baseURL := settings["llm_base_url"]
	model := settings["llm_model"]
	systemPrompt := settings["llm_system_prompt"]

	// Fallback to config if not set in DB
	if apiKey == "" {
		apiKey = config.AppConfig.LLMAPIKey
	}
	if baseURL == "" {
		baseURL = config.AppConfig.LLMBaseURL
	}
	if model == "" {
		model = config.AppConfig.LLMModel
	}
	if systemPrompt == "" {
		// Use hardcoded default if even DB is empty (shouldn't happen with InitDB)
		systemPrompt = `你现在是一位2025–2026年顶尖的AI文本取证与对抗样本分析师，同时具备中文学术写作、网络社区写作、营销文案、虚构小说等多种语体鉴别经验。

你的核心任务是：**尽可能准确判断给定的文本片段更大概率是由人类撰写，还是由当前主流大语言模型（包括但不限于GPT-4o系列、Claude 3.5/4、Gemini 2.0/2.5、Grok 3/4、DeepSeek-R1、Qwen 2.5-max、Llama-4系列、通义千问、豆包、Kimi等）生成或高度改写**。

请严格按照以下分步思考流程，不要跳步，不要提前下结论：

─────────────────────────────
阶段1：表面统计与模式匹配（必须量化）
─────────────────────────────
A. 句子长度与段落长度分布
   - 计算平均句长、句长标准差
   - 观察是否存在“句长过于均匀”（方差<8–10个汉字算异常）
   - 段落是否长度高度相似（尤其是4–8句/段的规律性）

B. 标点与排版习惯
   - 破折号（——）、冒号（：）+长插入语的频率
   - 括号解释句 / 补充说明句 的密度
   - 是否频繁出现“、”连续罗列超过4项

C. 高频功能词与模板化连接词（中文AI特别容易残留）
   - 统计并标记出现次数：从而、进而、因此、可见、不难看出、综上所述、由此可见、值得注意的是、可以看出、换言之、换句话说、另一方面、一方面……另一方面、不仅……而且、所谓、所谓的、其实、本质上、归根结底、总的来说、总而言之
   - 出现3个以上同类连接词且分布均匀 → 大幅加分AI倾向

D. 结构化表达倾向
   - 是否出现明显的“总-分-总”三段式、问题-分析-结论式
   - 是否有规整的“首先、其次、最后/综上”或“第一、第二、第三”
   - 是否每段首句高度概括或承上启下

─────────────────────────────
阶段2：语义与逻辑层面的AI指纹（更关键）
─────────────────────────────
E. 过度中立、过度平衡、假辩证
   - 是否同时肯定两边、用“但是”“然而”制造假对立后又调和
   - 是否出现“双刃剑”“利弊并存”“仁者见仁智者见智”式空洞总结

F. 事实陈述的泛化、空洞与“安全感”
   - 是否大量使用“通常”“一般而言”“在大多数情况下”“众所周知”
   - 是否回避具体年份、数据来源、争议细节，倾向于圆滑概括

G. 情感真实度与个性残留
   - 是否存在真正的主观偏见、情绪波动、个人化吐槽、反常识小抱怨
   - 是否完全没有语气词、口语残留（啊、吧、呗、嘛、啦、哎、其实我感觉……）

─────────────────────────────
阶段3：2025–2026年最新高级模型残留特征（最难模仿的部分）
─────────────────────────────
H. “隐形模板病”——即使刻意口语化也难完全消除
   - 微弱的“礼貌过载”：无必要客套、过度使用“我们”“您会发现”“相信大家都能理解”
   - 结尾强行“升华/展望/呼吁”倾向（让我们、期待、值得深思、未来可期……）
   - 轻微的“语义平滑过度”：几乎没有真正生硬的逻辑跳跃或前后小矛盾

I. 对抗性人类化失败的常见痕迹
   - 刻意加入的“错误”太均匀（错别字、口语化太有规律）
   - 刻意打乱段落但内在逻辑链仍然完整可逆推

─────────────────────────────
阶段4：综合判决（必须给出明确倾向）
─────────────────────────────
请在以上所有维度分析完成后，综合给出结果。

注意：为了适配系统可视化展示，你的输出必须包含以下格式的总结部分，方便程序解析：
[SUMMARY_START]
AI生成概率: [数字]%
置信度: [极高/高/中/低/极低]
相关性: [数字]
真实性: [数字]
完整性: [数字]
表达能力: [数字]
参考回复: [一段建议的回复文字]
关键证据:
1. [证据1]
2. [证据2]
3. [证据3]
[SUMMARY_END]
`
	}

	if apiKey == "" {
		return nil, fmt.Errorf("LLM API Key not configured")
	}

	userMessage := fmt.Sprintf("请分析以下文本：\n\n『%s』", content)

	requestBody, _ := json.Marshal(map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userMessage},
		},
		"temperature": 0.3,
	})

	apiURL := strings.TrimSuffix(baseURL, "/")
	if !strings.HasSuffix(apiURL, "/chat/completions") {
		apiURL += "/chat/completions"
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		log.Printf("[AIGC] LLM API error: status=%d, body=%s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("LLM API error (status %d): %s", resp.StatusCode, string(body))
	}

	var apiResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(body, &apiResp); err != nil {
		log.Printf("[AIGC] Failed to unmarshal LLM response: %v, body=%s", err, string(body))
		return nil, err
	}

	if len(apiResp.Choices) == 0 {
		return nil, fmt.Errorf("LLM API returned no choices")
	}

	fullAnalysis := apiResp.Choices[0].Message.Content

	// 移除可能存在的 <think> 标签（DeepSeek-R1 等模型可能输出）
	reThink := regexp.MustCompile(`(?s)<think>.*?</think>`)
	cleanedAnalysis := reThink.ReplaceAllString(fullAnalysis, "")
	cleanedAnalysis = strings.TrimSpace(cleanedAnalysis)

	return parseAIGCAnalysis(cleanedAnalysis), nil
}

func parseAIGCAnalysis(analysis string) *AIGCResult {
	result := &AIGCResult{
		Score:      0,
		Confidence: "中",
		Evidence:   "",
		Analysis:   analysis,
	}

	// 提取总结部分
	reSummary := regexp.MustCompile(`\[SUMMARY_START\]([\s\S]*?)\[SUMMARY_END\]`)
	match := reSummary.FindStringSubmatch(analysis)
	if len(match) > 1 {
		summary := match[1]

		// 提取概率
		reScore := regexp.MustCompile(`AI生成概率:\s*(\d+)%`)
		if m := reScore.FindStringSubmatch(summary); len(m) > 1 {
			score, _ := strconv.Atoi(m[1])
			result.Score = score
		}

		// 提取置信度
		reConf := regexp.MustCompile(`置信度:\s*(极高|高|中|低|极低)`)
		if m := reConf.FindStringSubmatch(summary); len(m) > 1 {
			result.Confidence = m[1]
		}

		// 提取评分项
		reRel := regexp.MustCompile(`相关性:\s*(\d+)`)
		if m := reRel.FindStringSubmatch(summary); len(m) > 1 {
			val, _ := strconv.Atoi(m[1])
			result.Relevance = val
		}

		reAuth := regexp.MustCompile(`真实性:\s*(\d+)`)
		if m := reAuth.FindStringSubmatch(summary); len(m) > 1 {
			val, _ := strconv.Atoi(m[1])
			result.Authenticity = val
		}

		reComp := regexp.MustCompile(`完整性:\s*(\d+)`)
		if m := reComp.FindStringSubmatch(summary); len(m) > 1 {
			val, _ := strconv.Atoi(m[1])
			result.Completeness = val
		}

		reExpr := regexp.MustCompile(`表达能力:\s*(\d+)`)
		if m := reExpr.FindStringSubmatch(summary); len(m) > 1 {
			val, _ := strconv.Atoi(m[1])
			result.Expression = val
		}

		// 提取参考回复
		reReply := regexp.MustCompile(`参考回复:\s*([\s\S]*?)(?:\n关键证据:|$)`)
		if m := reReply.FindStringSubmatch(summary); len(m) > 1 {
			result.Reply = strings.TrimSpace(m[1])
		}

		// 提取关键证据
		reEvidence := regexp.MustCompile(`关键证据:\s*([\s\S]*)`)
		if m := reEvidence.FindStringSubmatch(summary); len(m) > 1 {
			evidences := strings.TrimSpace(m[1])
			result.Evidence = evidences
		}
	} else {
		// 如果没有找到标记，尝试直接从全文搜索
		reScore := regexp.MustCompile(`AI生成概率[：:]\s*(\d+)%`)
		if m := reScore.FindStringSubmatch(analysis); len(m) > 1 {
			score, _ := strconv.Atoi(m[1])
			result.Score = score
		}

		reConf := regexp.MustCompile(`置信度[：:]\s*(极高|高|中|低|极低)`)
		if m := reConf.FindStringSubmatch(analysis); len(m) > 1 {
			result.Confidence = m[1]
		}
	}

	return result
}
