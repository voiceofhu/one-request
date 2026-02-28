# 获取当前时间并格式化版本号
VERSION := $(shell TZ="Asia/Shanghai" date +"%y.%m%d.%H%M")
# 默认提交消息
DEFAULT_MSG := "bump version to v$(VERSION)"


# 检查 pnpm 是否安装
PNPM := $(shell command -v pnpm 2> /dev/null)
ifeq ($(strip $(PNPM)),)
$(error pnpm is not installed. Please install pnpm first)
endif

.PHONY: install lint test build quality package dev update-version push-version push-tag

# 安装依赖
install:
	@$(PNPM) install

# 代码检查
lint:
	@$(PNPM) run lint

# 运行测试
test:
	@$(PNPM) run test

# 构建插件
build:
	@$(PNPM) run build

# 质量与性能检查脚本
quality:
	@$(PNPM) run quality

# 打包 VSCode 插件（生成 .vsix）
package:
	@$(PNPM) run package:vsix

# 更新版本号，增加错误处理
update-version:
	@if [ -f "package.json" ]; then \
		echo "Updating package.json version to $(VERSION)"; \
		node -e "const fs = require('fs'); \
			const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')); \
			pkg.version = '$(VERSION)'; \
			fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));" || \
		(echo "Failed to update package.json"; exit 1); \
	else \
		echo "package.json not found"; \
		exit 1; \
	fi

# 提交版本变更到Git
push-version: update-version
	@echo "Committing version change"
	@git diff --quiet package.json || \
		(git add . && \
		git commit -m "bump version to v$(VERSION)" && \
		git push) || \
		(echo "Git commit failed"; exit 1)

# 创建并推送标签
push-tag: push-version
	@echo "Creating and pushing tag v$(VERSION)"
	@git tag v$(VERSION) && \
		git push origin v$(VERSION) || \
		(echo "Failed to create and push tag"; exit 1)

# 开发环境
dev:
	@$(PNPM) run watch
