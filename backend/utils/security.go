package utils

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// StarMoonSecurity 星月御安全加密系统
type StarMoonSecurity struct{}

// DecryptData 解密并验证数据
func (s *StarMoonSecurity) DecryptData(encryptedStr, fingerprint string, nonce int) (map[string]interface{}, error) {
	km := GetKeyManager()

	// 首先尝试使用当前密钥解密
	data, err := s.decryptWithKey(encryptedStr, fingerprint, nonce, km.DeriveKey(fingerprint, nonce))
	if err == nil {
		return data, nil
	}

	// 如果失败，尝试使用上一个密钥解密（密钥轮换期间的兼容性）
	previousKey := km.TryDeriveKeyWithPrevious(fingerprint, nonce)
	if previousKey != "" {
		data, err = s.decryptWithKey(encryptedStr, fingerprint, nonce, previousKey)
		if err == nil {
			return data, nil
		}
	}

	return nil, fmt.Errorf("decryption failed with all available keys")
}

// decryptWithKey 使用指定密钥解密
func (s *StarMoonSecurity) decryptWithKey(encryptedStr, fingerprint string, nonce int, dynamicKey string) (map[string]interface{}, error) {
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

// HashPassword SHA256 密码哈希
func HashPassword(password string) string {
	hash := sha256.Sum256([]byte(password))
	return fmt.Sprintf("%x", hash)
}

// CheckPassword 验证密码
func CheckPassword(password, hash string) bool {
	return HashPassword(password) == hash
}
