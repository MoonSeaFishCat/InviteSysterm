package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port      string
	DBPath    string
	JWTSecret string
	GinMode   string
}

var AppConfig *Config

// LoadConfig 加载配置
func LoadConfig() {
	// 尝试加载 .env 文件（开发环境）
	_ = godotenv.Load()

	AppConfig = &Config{
		Port:      getEnv("SERVER_PORT", "8080"),
		DBPath:    getEnv("DATABASE_PATH", "./invite.db"),
		JWTSecret: getEnv("JWT_SECRET", "default_jwt_secret_key_change_me"),
		GinMode:   getEnv("GIN_MODE", "debug"),
	}

	log.Printf("Config loaded: Port=%s, DBPath=%s, Mode=%s\n", AppConfig.Port, AppConfig.DBPath, AppConfig.GinMode)
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
