package utils

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

const BASE_KEY = "star-moon-v2-hyper-secret"

// StarMoonSecurity 星月御安全加密系统
type StarMoonSecurity struct{}

// DecryptData 解密并验证数据
func (s *StarMoonSecurity) DecryptData(encryptedStr, fingerprint string, nonce int) (map[string]interface{}, error) {
	dynamicKey := s.deriveDynamicKey(fingerprint, nonce)

	// Base64 解码
	encryptedBytes, err := base64.StdEncoding.DecodeString(encryptedStr)
	if err != nil {
		return nil, fmt.Errorf("base64 decode failed: %v", err)
	}

	bytes := make([]byte, len(encryptedBytes))
	copy(bytes, encryptedBytes)

	// 逆向 7 轮混淆
	for round := 6; round >= 0; round-- {
		// 反转
		for i, j := 0, len(bytes)-1; i < j; i, j = i+1, j-1 {
			bytes[i], bytes[j] = bytes[j], bytes[i]
		}

		for i := 0; i < len(bytes); i++ {
			keyChar := dynamicKey[i%len(dynamicKey)]
			shift := (round + i) % 8

			processed := bytes[i] ^ byte(round*13)
			// 逆向位移
			processed = ((processed >> uint(shift)) | (processed << uint(8-shift))) & 0xFF
			bytes[i] = processed ^ keyChar
		}
	}

	// 解析数据
	result := string(bytes)
	parts := strings.Split(result, "|")
	if len(parts) != 4 {
		return nil, fmt.Errorf("invalid decrypted data format")
	}

	timestamp, fId, n, jsonStr := parts[0], parts[1], parts[2], parts[3]

	// 1. 时间戳校验（10分钟有效期）
	var ts int64
	fmt.Sscanf(timestamp, "%d", &ts)
	if time.Now().Unix()-ts > 600 {
		return nil, fmt.Errorf("request expired")
	}

	// 2. 指纹校验
	if fId != fingerprint {
		return nil, fmt.Errorf("fingerprint mismatch")
	}

	// 3. Nonce 校验
	var storedNonce int
	fmt.Sscanf(n, "%d", &storedNonce)
	if storedNonce != nonce {
		return nil, fmt.Errorf("nonce mismatch")
	}

	// 4. 解析 JSON
	var data map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
		return nil, fmt.Errorf("json parse failed: %v", err)
	}

	return data, nil
}

// deriveDynamicKey 动态密钥生成
func (s *StarMoonSecurity) deriveDynamicKey(fingerprint string, nonce int) string {
	key := fmt.Sprintf("%s%s%d", BASE_KEY, fingerprint, nonce)

	// 7 轮混淆
	for i := 0; i < 7; i++ {
		key = base64.StdEncoding.EncodeToString([]byte(key))
		if len(key) > 32 {
			key = key[:32]
		}
	}

	return key
}

// HashPassword SHA256 密码哈希
func HashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return fmt.Sprintf("%x", hash)
}
