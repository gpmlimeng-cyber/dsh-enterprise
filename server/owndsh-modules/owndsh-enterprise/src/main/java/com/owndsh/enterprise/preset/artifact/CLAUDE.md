# artifact/

> L2 | 父级: ../CLAUDE.md

成员清单

PresetArtifactException.java: ENT_PRESET_INVALID_PACKAGE 与 ENT_PRESET_TOO_LARGE 稳定错误边界。
PresetArtifactInspector.java: 单遍 ZIP 验包闸门，校验路径安全、manifest 必填字段、dependencies 形状（元素未知键与 resolvedVersionId 一律拒包）与 agent.cordis.yml 存在性，不解压到文件系统；顶层未知键仍被忽略。
PresetArtifactStore.java: `.part` 有界写入/SHA-256、hash 锁、原子 CAS 终结与受控读取定位。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
