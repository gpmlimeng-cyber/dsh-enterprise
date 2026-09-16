# 第三方组件与许可

本部署层包含以下第三方组件。上游许可文本随仓库提供；未随附的请见对应项目。

| 组件 | 版本/来源 | 许可 | 位置 |
|---|---|---|---|
| Scalar API Reference | `@scalar/api-reference` 1.68.0（浏览器构建） | MIT | `api-docs/vendor/scalar.standalone.js` |
| Inter（可变字体） | Inter Variable，woff2 子集 | SIL Open Font License 1.1 | `docs-assets/fonts/inter-*.woff2`、`licenses/INTER-LICENSE.txt` |
| JetBrains Mono（可变字体） | JetBrains Mono Variable，woff2 子集 | SIL Open Font License 1.1 | `docs-assets/fonts/jetbrains-mono-*.woff2` |
| Lucide 图标 | 经上游控制台使用的图标集 | ISC | `licenses/LUCIDE-LICENSE.txt` |
| DeepSeek Harness | 上游产品 | MIT（见上游仓库） | 不在本仓库内 |

说明：
- 字体与图标文件随站点自托管，**不依赖任何外部 CDN**；
- Scalar 渲染器同样自托管，构建期校验其 sha256（见 `api-docs/vendor/scalar.standalone.js.sha256`）；
- OwnDsh 是独立项目，与 DeepSeek AI 或 Anywhere Labs 无隶属关系。
