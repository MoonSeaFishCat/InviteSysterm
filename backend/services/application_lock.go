package services

import (
	"sync"
	"time"
)

// ApplicationLock 申请锁定信息
type ApplicationLock struct {
	AdminID   int
	AdminName string
	LockedAt  time.Time
}

// ApplicationLockManager 申请锁定管理器
type ApplicationLockManager struct {
	locks map[int]*ApplicationLock // key: application_id
	mu    sync.RWMutex
}

var lockManager = &ApplicationLockManager{
	locks: make(map[int]*ApplicationLock),
}

// GetLockManager 获取锁定管理器实例
func GetLockManager() *ApplicationLockManager {
	return lockManager
}

// LockApplication 锁定申请
func (m *ApplicationLockManager) LockApplication(appID, adminID int, adminName string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 检查是否已被锁定
	if lock, exists := m.locks[appID]; exists {
		// 如果是同一个管理员，允许（刷新锁定时间）
		if lock.AdminID == adminID {
			lock.LockedAt = time.Now()
			return true
		}
		// 检查锁定是否超时（5分钟）
		if time.Since(lock.LockedAt) < 5*time.Minute {
			return false
		}
		// 锁定超时，可以被新管理员接管
	}

	// 创建新锁定
	m.locks[appID] = &ApplicationLock{
		AdminID:   adminID,
		AdminName: adminName,
		LockedAt:  time.Now(),
	}
	return true
}

// UnlockApplication 解锁申请
func (m *ApplicationLockManager) UnlockApplication(appID, adminID int) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if lock, exists := m.locks[appID]; exists {
		// 只有锁定者本人可以解锁
		if lock.AdminID == adminID {
			delete(m.locks, appID)
		}
	}
}

// GetLock 获取申请的锁定信息
func (m *ApplicationLockManager) GetLock(appID int) *ApplicationLock {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if lock, exists := m.locks[appID]; exists {
		// 检查锁定是否超时
		if time.Since(lock.LockedAt) < 5*time.Minute {
			return lock
		}
		// 锁定已超时，返回 nil
		return nil
	}
	return nil
}

// IsLocked 检查申请是否被锁定
func (m *ApplicationLockManager) IsLocked(appID, adminID int) (bool, *ApplicationLock) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if lock, exists := m.locks[appID]; exists {
		// 检查锁定是否超时
		if time.Since(lock.LockedAt) < 5*time.Minute {
			// 如果是同一个管理员，返回未锁定
			if lock.AdminID == adminID {
				return false, nil
			}
			return true, lock
		}
	}
	return false, nil
}

// CleanExpiredLocks 清理过期的锁定（定期调用）
func (m *ApplicationLockManager) CleanExpiredLocks() {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now()
	for appID, lock := range m.locks {
		if now.Sub(lock.LockedAt) >= 5*time.Minute {
			delete(m.locks, appID)
		}
	}
}

// StartCleanupRoutine 启动清理协程
func (m *ApplicationLockManager) StartCleanupRoutine() {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			m.CleanExpiredLocks()
		}
	}()
}

