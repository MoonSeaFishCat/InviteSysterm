package utils

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// GeetestV4Response 极验4.0 API 响应结构
type GeetestV4Response struct {
	Result string `json:"result"`
	Reason string `json:"reason"`
	Msg    string `json:"msg"`
}

// VerifyGeetestV4 极验4.0 二次校验逻辑
// 官方文档：https://docs.geetest.com/gt4/deploy/server/gobuild
func VerifyGeetestV4(captchaID, captchaKey, lotNumber, captchaOutput, passToken, genTime string) (bool, error) {
	if captchaID == "" || captchaKey == "" {
		return true, nil // 未配置时默认跳过验证（生产环境应配置为必填）
	}

	// 1. 生成签名 sign_token
	// 使用 hmac-sha256 算法，以 captcha_key 为密钥，以 lot_number 为数据生成签名
	h := hmac.New(sha256.New, []byte(captchaKey))
	h.Write([]byte(lotNumber))
	signToken := hex.EncodeToString(h.Sum(nil))

	// 2. 准备校验请求参数
	apiURL := "https://gcaptcha4.geetest.com/validate"
	params := url.Values{}
	params.Set("captcha_id", captchaID)
	params.Set("lot_number", lotNumber)
	params.Set("captcha_output", captchaOutput)
	params.Set("pass_token", passToken)
	params.Set("gen_time", genTime)
	params.Set("sign_token", signToken)

	// 3. 发送 GET 请求进行校验
	queryURL := fmt.Sprintf("%s?%s", apiURL, params.Encode())
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(queryURL)
	if err != nil {
		return false, fmt.Errorf("geetest api request failed: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("read geetest response failed: %v", err)
	}

	var gresp GeetestV4Response
	if err := json.Unmarshal(body, &gresp); err != nil {
		return false, fmt.Errorf("parse geetest response failed: %v", err)
	}

	// 4. 返回校验结果
	return gresp.Result == "success", nil
}
