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
}

var AppConfig *Config

// LoadConfig 加载配置
func LoadConfig() {
	// 尝试加载 .env 文件（开发环境）
	_ = godotenv.Load()

	AppConfig = &Config{
		Port:      getEnv("PORT", "8080"),
		DBPath:    getEnv("DB_PATH", "./invite.db"),
		JWTSecret: getEnv("JWT_SECRET", "default_jwt_secret_key_change_me"),
	}

	log.Printf("Config loaded: Port=%s, DBPath=%s\n", AppConfig.Port, AppConfig.DBPath)
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
