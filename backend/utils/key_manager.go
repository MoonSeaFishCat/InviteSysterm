package utils

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"sync"
	"time"
)

// KeyManager 密钥管理器
type KeyManager struct {
	currentKey  string
	previousKey string
	mu          sync.RWMutex
	rotateTimer *time.Timer
}

var (
	globalKeyManager *KeyManager
	keyManagerOnce   sync.Once
)

// GetKeyManager 获取全局密钥管理器实例
func GetKeyManager() *KeyManager {
	keyManagerOnce.Do(func() {
		globalKeyManager = &KeyManager{}
		globalKeyManager.initialize()
	})
	return globalKeyManager
}

// initialize 初始化密钥管理器
func (km *KeyManager) initialize() {
	// 生成初始密钥
	km.currentKey = km.generateKey()
	log.Printf("[KeyManager] 初始密钥已生成")

	// 启动定期轮换（每24小时）
	km.startAutoRotation(24 * time.Hour)
}

// generateKey 生成随机密钥
func (km *KeyManager) generateKey() string {
	// 生成 32 字节的随机密钥
	keyBytes := make([]byte, 32)
	if _, err := rand.Read(keyBytes); err != nil {
		log.Fatalf("[KeyManager] 生成密钥失败: %v", err)
	}

	// Base64 编码
	key := base64.StdEncoding.EncodeToString(keyBytes)
	
	// 进行 7 轮混淆（与前端保持一致）
	for i := 0; i < 7; i++ {
		key = base64.StdEncoding.EncodeToString([]byte(key))
		if len(key) > 32 {
			key = key[:32]
		}
	}

	return key
}

// GetCurrentKey 获取当前密钥
func (km *KeyManager) GetCurrentKey() string {
	km.mu.RLock()
	defer km.mu.RUnlock()
	return km.currentKey
}

// GetPreviousKey 获取上一个密钥（用于解密旧数据）
func (km *KeyManager) GetPreviousKey() string {
	km.mu.RLock()
	defer km.mu.RUnlock()
	return km.previousKey
}

// RotateKey 手动轮换密钥
func (km *KeyManager) RotateKey() {
	km.mu.Lock()
	defer km.mu.Unlock()

	// 保存当前密钥为上一个密钥
	km.previousKey = km.currentKey

	// 生成新密钥
	km.currentKey = km.generateKey()

	log.Printf("[KeyManager] 密钥已轮换")
}

// startAutoRotation 启动自动轮换
func (km *KeyManager) startAutoRotation(interval time.Duration) {
	km.rotateTimer = time.AfterFunc(interval, func() {
		km.RotateKey()
		// 递归调用，继续下一次轮换
		km.startAutoRotation(interval)
	})
	log.Printf("[KeyManager] 自动密钥轮换已启动，间隔: %v", interval)
}

// StopAutoRotation 停止自动轮换
func (km *KeyManager) StopAutoRotation() {
	if km.rotateTimer != nil {
		km.rotateTimer.Stop()
		log.Printf("[KeyManager] 自动密钥轮换已停止")
	}
}

// DeriveKey 派生动态密钥（用于加密/解密）
func (km *KeyManager) DeriveKey(fingerprint string, nonce int) string {
	baseKey := km.GetCurrentKey()
	key := fmt.Sprintf("%s%s%d", baseKey, fingerprint, nonce)

	// 7 轮混淆
	for i := 0; i < 7; i++ {
		key = base64.StdEncoding.EncodeToString([]byte(key))
		if len(key) > 32 {
			key = key[:32]
		}
	}

	return key
}

// TryDeriveKeyWithPrevious 尝试使用上一个密钥派生（用于解密旧数据）
func (km *KeyManager) TryDeriveKeyWithPrevious(fingerprint string, nonce int) string {
	previousKey := km.GetPreviousKey()
	if previousKey == "" {
		return ""
	}

	key := fmt.Sprintf("%s%s%d", previousKey, fingerprint, nonce)

	// 7 轮混淆
	for i := 0; i < 7; i++ {
		key = base64.StdEncoding.EncodeToString([]byte(key))
		if len(key) > 32 {
			key = key[:32]
		}
	}

	return key
}

