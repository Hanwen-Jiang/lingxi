#!/usr/bin/env python3
"""Generate logic-tree project documentation for InfiniteChat-Agent.

The generator intentionally reads the current worktree and writes Markdown under
`docs/project-structure/`. It excludes generated/local-only folders and gives one
section per tracked project file.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "project-structure"

EXCLUDED_PARTS = {".git", "target", ".idea", ".settings", ".mvn", "__pycache__", "docs/project-structure"}
EXCLUDED_NAMES = {".DS_Store"}

CATEGORY_ORDER = [
    "01-root-and-build",
    "02-runtime-config-and-resources",
    "03-api-and-common-infrastructure",
    "04-agent-react-and-tooling",
    "05-memory-agent",
    "06-rag-and-adaptive-rag",
    "07-model-observability-and-ai-chat",
    "08-existing-docs-and-test-assets",
    "09-tests",
]

CATEGORY_TITLES = {
    "01-root-and-build": "根目录、构建与工程元数据",
    "02-runtime-config-and-resources": "运行配置、知识资源与前端页面",
    "03-api-and-common-infrastructure": "HTTP 接口、通用响应、异常与安全护轨",
    "04-agent-react-and-tooling": "ReAct Agent、Planner、工具注册与工具治理",
    "05-memory-agent": "Memory Agent、会话摘要、长期记忆与反思记忆",
    "06-rag-and-adaptive-rag": "RAG、Hybrid Search、Rerank 与 Adaptive RAG",
    "07-model-observability-and-ai-chat": "模型配置、AI Chat、监控与基础 DTO",
    "08-existing-docs-and-test-assets": "既有设计文档、Postman 集合与脚本资产",
    "09-tests": "测试代码",
}

CATEGORY_INTROS = {
    "01-root-and-build": "这一组描述项目如何被 Maven、IDE 和 Git 识别，以及本地启动入口文档。它们不直接承载业务逻辑，但决定工程如何编译、运行、协作和分发。",
    "02-runtime-config-and-resources": "这一组描述运行时配置、系统提示词、内置知识库文档、前端静态页面等资源。它们影响服务端口、数据源、模型供应商、检索参数、记忆参数和用户可见页面。",
    "03-api-and-common-infrastructure": "这一组位于外部请求进入系统的边界，包含 Controller、统一响应、业务异常和输入护轨。它负责把 HTTP 请求转换为内部服务调用，并把异常整理成稳定响应。",
    "04-agent-react-and-tooling": "这一组实现 ReAct Agent 主链路：上下文准备、Planner 决策、工具选择、工具执行、工具治理和可观测 trace。它是普通对话升级为可行动 Agent 的核心。",
    "05-memory-agent": "这一组实现记忆系统：短期历史窗口、会话摘要、长期记忆、相关记忆检索、反思记忆、去重和纠错。它支撑跨轮次、跨会话的连续性与个性化。",
    "06-rag-and-adaptive-rag": "这一组实现知识库问答：文档入库、向量检索、关键词检索、混合融合、重排序、引用生成，以及可自适应规划/重写/评估的多轮检索。",
    "07-model-observability-and-ai-chat": "这一组提供模型接入、传统 AI Chat 服务、监控指标和基础请求 DTO。它们为 Agent 与 RAG 提供底层模型能力和运行可观测性。",
    "08-existing-docs-and-test-assets": "这一组是项目已有的人类文档、Postman 集合和辅助脚本，记录阶段性设计、测试入口与本地外部服务搭建方式。",
    "09-tests": "这一组描述当前测试覆盖点。测试主要覆盖文档切分、路径校验、OpenAPI 配置、输入护轨、长期记忆相似度/合并和 OpenAI 兼容模型解析。",
}

MODULE_NOTES = {
    "com.lou.infinitechatagent.agent": "Agent 编排模块",
    "com.lou.infinitechatagent.agent.context": "Agent 输入上下文准备模块",
    "com.lou.infinitechatagent.agent.dto": "Agent 请求、响应与 ReAct trace 数据模型",
    "com.lou.infinitechatagent.agent.governance": "工具治理与审计模块",
    "com.lou.infinitechatagent.agent.governance.dto": "工具治理审计 DTO",
    "com.lou.infinitechatagent.agent.planner": "Agent Planner 模块",
    "com.lou.infinitechatagent.agent.tool": "Agent 工具注册与外部搜索模块",
    "com.lou.infinitechatagent.ai": "LangChain4j AI Service 模块",
    "com.lou.infinitechatagent.common": "通用响应封装模块",
    "com.lou.infinitechatagent.config": "Spring 与 LangChain4j 配置模块",
    "com.lou.infinitechatagent.controller": "HTTP Controller 模块",
    "com.lou.infinitechatagent.exception": "异常体系模块",
    "com.lou.infinitechatagent.guardrail": "输入安全护轨模块",
    "com.lou.infinitechatagent.guardrail.dto": "输入护轨 DTO",
    "com.lou.infinitechatagent.job": "启动任务模块",
    "com.lou.infinitechatagent.memory": "Memory Agent 核心模块",
    "com.lou.infinitechatagent.memory.dto": "Memory Agent 数据模型",
    "com.lou.infinitechatagent.model.dto": "通用模型请求 DTO",
    "com.lou.infinitechatagent.monitor": "模型调用监控模块",
    "com.lou.infinitechatagent.rag": "基础 RAG 与 Hybrid Search 模块",
    "com.lou.infinitechatagent.rag.adaptive": "Adaptive RAG 编排与策略模块",
    "com.lou.infinitechatagent.rag.adaptive.dto": "Adaptive RAG 数据模型",
    "com.lou.infinitechatagent.rag.dto": "RAG 入库、检索和引用 DTO",
    "com.lou.infinitechatagent.tool": "LangChain4j 工具函数模块",
}

METHOD_IGNORE = {"if", "for", "while", "switch", "catch", "return", "new", "this", "super"}
LOW_VALUE_ANNOTATIONS = {"Data", "NoArgsConstructor", "AllArgsConstructor", "Builder", "Getter", "Setter", "Accessors"}

BUSINESS_HINTS = [
    ("ReActAgentOrchestrator", "ReAct Agent 主编排器，串联上下文、Planner、工具治理、工具执行、RAG、记忆写入/搜索、Web Search 和最终响应构造。"),
    ("AgentContextManager", "Agent 输入上下文管理器，负责读取 Memory Agent 上下文、压缩历史消息、估算 token，并组装直接回答 Prompt。"),
    ("AgentContext", "Agent 本轮输入上下文包，保存用户问题、记忆追踪、记忆文本、历史窗口、压缩/截断标记和 token 估算。"),
    ("RuleBasedAgentPlanner", "规则 Planner，通过关键词、邮箱、时间、记忆和检索判断生成可解释 AgentPlan。"),
    ("LlmAgentPlanner", "LLM Planner，用模型根据可用工具和用户问题输出 JSON 计划，失败时回退规则 Planner。"),
    ("ToolGovernanceService", "工具执行前治理服务，负责风险等级、确认门槛、Prompt Injection 检测和审计落库。"),
    ("ToolRegistry", "工具注册表，集中声明当前时间、Hybrid Search、直接回答、记忆写入/搜索、邮件和 Web Search 等工具。"),
    ("MemoryAgent", "记忆系统统一门面，编排读上下文、摘要刷新和反思写入。"),
    ("LongTermMemoryService", "长期记忆服务，负责写入、相似去重合并、纠错、禁用和查询 ACTIVE 记忆。"),
    ("MemoryContextBuilder", "记忆上下文构建器，组合会话摘要和相关长期记忆，并估算记忆 token。"),
    ("MemoryRetrievalService", "长期记忆召回器，按提示词、类型权重、关键词覆盖和置信度计算相关性并控制预算。"),
    ("SessionSummaryService", "会话摘要服务，从 Redis 历史中触发摘要生成并写入 MySQL。"),
    ("ReflectiveMemoryService", "反思记忆服务，将证据不足、纠错等事件沉淀为 REFLECTION 长期记忆。"),
    ("RuleBasedMemoryPlanner", "规则记忆 Planner，判断是否读取记忆、刷新摘要、写反思及原因。"),
    ("AdaptiveRagOrchestrator", "Adaptive RAG 主编排器，执行检索规划、召回、融合、重排、证据评估、查询改写、回答生成和 debug 输出。"),
    ("RuleBasedRetrievalPlanner", "规则检索规划器，判断是否检索以及使用 VECTOR、KEYWORD 或 HYBRID 策略。"),
    ("LlmRetrievalPlanner", "LLM 检索规划器，用模型输出检索计划，并对 TopK 与策略做规范化。"),
    ("AdaptiveRetrievalPlannerRouter", "Adaptive RAG Planner 路由器，根据配置在规则 Planner 与 LLM Planner 间切换。"),
    ("RuleBasedEvidenceEvaluator", "规则证据评估器，根据最高分、覆盖度、引用数量和缺失方面判断证据是否充分。"),
    ("RuleBasedQueryRewriteService", "规则查询改写器，根据缺失方面、错误码、配置名和已召回片段补充检索词。"),
    ("RagQueryService", "传统 RAG 问答服务，处理 Hybrid Search、Rerank、token 预算、Prompt 构造、模型调用和引用返回。"),
    ("DocumentIngestionService", "文档入库服务，读取 PDF/Office/Markdown/文本，按章节切块，写入向量库和元数据表。"),
    ("HybridSearchService", "混合检索服务，融合向量召回与关键词召回并用 RRF 排序。"),
    ("BgeRerankService", "BGE/TEI 重排序服务，调用外部 rerank endpoint，失败时可降级规则重排。"),
    ("VectorSearchService", "向量检索服务，基于 EmbeddingStore 搜索相关文本片段。"),
    ("KeywordSearchService", "关键词检索服务，基于 SQL LIKE/关键词打分召回片段。"),
    ("RagSchemaInitializer", "RAG 表结构初始化器，创建/补齐文档 chunk 元数据表与索引。"),
    ("RagDataLoader", "应用启动数据加载器，自动把配置目录下的知识文档入库。"),
    ("AiModelConfig", "模型配置入口，根据 provider 创建 DashScope 或 OpenAI-compatible 模型、流式模型和 embedding 模型。"),
    ("OpenAiCompatibleChatModel", "OpenAI-compatible ChatModel 适配器，兼容普通 JSON 和 SSE 风格响应解析，并转换工具 schema。"),
    ("HashEmbeddingModel", "确定性 Hash embedding，用于测试或无真实 embedding provider 场景。"),
    ("McpToolConfig", "MCP 工具提供器配置，按开关接入外部搜索和时间 MCP 工具。"),
    ("AiChatService", "LangChain4j AI Service 配置，把模型、记忆、RAG Retriever 和工具绑定到 AiChat。"),
    ("AiChat", "声明式 AI Chat 接口，使用输入护轨并支持普通/流式对话。"),
    ("InputSafetyService", "输入安全检测服务，识别 Prompt Injection 和暴力意图等风险。"),
    ("SafeInputGuardrail", "LangChain4j 输入护轨适配器，将 InputSafetyService 接入 AI Service 调用。"),
    ("AiModelMetricsCollector", "Micrometer 指标采集器，记录模型请求、错误、token 和响应耗时。"),
    ("AiModelMonitorListener", "LangChain4j ChatModelListener，围绕模型请求/响应/异常写入监控指标。"),
]


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def should_include(p: Path) -> bool:
    r = rel(p)
    if p.name in EXCLUDED_NAMES:
        return False
    if p.suffix in {".pyc", ".pyo"}:
        return False
    parts = set(p.relative_to(ROOT).parts)
    if any(part in EXCLUDED_PARTS for part in parts):
        return False
    if r.startswith("docs/project-structure/"):
        return False
    return p.is_file()


def included_files() -> list[Path]:
    return sorted(p for p in ROOT.rglob("*") if should_include(p))


def category_for(r: str) -> str:
    if r.startswith("src/test/"):
        return "09-tests"
    if r.startswith("docs/") or r.startswith("scripts/"):
        return "08-existing-docs-and-test-assets"
    if r.startswith("src/main/resources/"):
        return "02-runtime-config-and-resources"
    if r in {"pom.xml", "mvnw", "mvnw.cmd", "README.md", ".env.example", ".gitignore", ".gitattributes", ".classpath", ".project", ".factorypath"}:
        return "01-root-and-build"
    if "/controller/" in r or "/common/" in r or "/exception/" in r or "/guardrail/" in r:
        return "03-api-and-common-infrastructure"
    if "/agent/" in r:
        return "04-agent-react-and-tooling"
    if "/memory/" in r:
        return "05-memory-agent"
    if "/rag/" in r:
        return "06-rag-and-adaptive-rag"
    if "/config/" in r or "/ai/" in r or "/monitor/" in r or "/model/" in r or "/tool/" in r or "/job/" in r:
        return "07-model-observability-and-ai-chat"
    return "08-existing-docs-and-test-assets"


def read_text(p: Path, limit: int | None = None) -> str:
    try:
        data = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""
    return data if limit is None else data[:limit]


def strip_java_noise(text: str) -> str:
    """Remove comments and string literals before regex-based Java structure scans."""
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r'""".*?"""', '""', text, flags=re.S)
    text = re.sub(r'"(?:\\.|[^"\\])*"', '""', text)
    text = re.sub(r"//.*", "", text)
    return text


def parse_java(p: Path) -> dict:
    text = read_text(p)
    code = strip_java_noise(text)
    pkg = re.search(r"^package\s+([\w.]+);", text, re.M)
    kind = re.search(r"public\s+(?:abstract\s+)?(class|interface|enum|record)\s+(\w+)", text)
    if not kind:
        kind = re.search(r"\b(record)\s+(\w+)\s*\(", text)
    anns = re.findall(r"^\s*@(\w+)(?:\([^\n]*\))?", code, re.M)
    fields = []
    for m in re.finditer(r"(?m)^[ \t]*(?:private|public|protected)[ \t]+(?:static[ \t]+)?(?:final[ \t]+)?([\w<>?, \t\[\].]+)[ \t]+(\w+)[ \t]*(?:=|;)", code):
        typ = " ".join(m.group(1).split())
        name = m.group(2)
        fields.append((name, typ))
    class_name = kind.group(2) if kind else p.stem
    methods = []
    # public/protected/private methods
    for m in re.finditer(r"(?m)^[ \t]*(?:public|protected|private)[ \t]+(?:static[ \t]+)?(?:final[ \t]+)?(?:<[^>\n]+>[ \t]+)?[\w<>?, \t\[\].]+[ \t]+(\w+)[ \t]*\([^;{}]*\)[ \t]*(?:throws [^{\n]+)?\{", code):
        name = m.group(1)
        if name not in METHOD_IGNORE and name != class_name and name not in methods:
            methods.append(name)
    # interface methods without body
    if kind and kind.group(1) == "interface":
        for m in re.finditer(r"(?m)^[ \t]*(?:[\w<>?, \t\[\].]+)[ \t]+(\w+)[ \t]*\([^{}\n]*\)[ \t]*;", code):
            name = m.group(1)
            if name not in METHOD_IGNORE and name != class_name and name not in methods:
                methods.append(name)
    enum_values = []
    if kind and kind.group(1) == "enum":
        body = text[text.find("{")+1:text.find(";") if ";" in text[text.find("{"):] else text.find("}")]
        enum_values = [x.strip() for x in re.split(r",", body) if x.strip() and re.match(r"^[A-Z0-9_]+$", x.strip())]
    imports = re.findall(r"^import\s+([\w.*]+);", text, re.M)
    return {
        "package": pkg.group(1) if pkg else "",
        "kind": kind.group(1) if kind else "文件",
        "name": class_name,
        "annotations": anns,
        "fields": fields,
        "methods": methods,
        "enum_values": enum_values,
        "imports": imports,
        "lines": text.count("\n") + (1 if text else 0),
    }


def hint_for_java(info: dict, r: str) -> str:
    name = info["name"]
    for key, val in BUSINESS_HINTS:
        if name == key:
            return val
    pkg = info.get("package", "")
    module = MODULE_NOTES.get(pkg)
    kind = info.get("kind", "文件")
    fields = [n for n, _ in info.get("fields", [])]
    methods = info.get("methods", [])
    if kind == "enum":
        vals = "、".join(info.get("enum_values", [])[:8])
        return f"枚举类型，约束 {module or pkg or '当前模块'} 中的固定取值" + (f"：{vals}。" if vals else "。")
    if kind == "interface":
        return f"接口抽象，定义 {module or pkg or '当前模块'} 的可替换能力边界，主要方法为 {', '.join(methods[:5]) or '无显式方法'}。"
    if r.endswith("Request.java"):
        return "请求 DTO，承载 Controller 或服务入口接收的参数，通常只包含字段和 Lombok 访问器。"
    if r.endswith("Response.java") or r.endswith("Result.java"):
        return "响应/结果 DTO，承载服务处理后的结构化返回数据，便于接口和 debug 信息序列化。"
    if r.endswith("Config.java"):
        return "Spring 配置类，集中创建 Bean 或绑定外部配置。"
    if r.endswith("Controller.java"):
        return "HTTP Controller，暴露 REST 接口并将请求转交给对应业务服务。"
    if r.endswith("Service.java"):
        return f"业务服务类，属于 {module or pkg or '当前模块'}，核心方法包括 {', '.join(methods[:6]) or '无显式方法'}。"
    if fields:
        return f"{module or pkg or '业务'}中的数据/组件类，核心字段包括 {', '.join(fields[:6])}。"
    return f"{module or pkg or '项目'}中的 {kind} 文件。"


def is_dto_file(r: str, info: dict) -> bool:
    name = info.get("name", "")
    return (
        "/dto/" in r
        or "/model/dto/" in r
        or "/common/" in r
        or name.endswith("Request")
        or name.endswith("Response")
        or name.endswith("Result")
        or name in {"BaseResponse"}
    )


def field_description(class_name: str, field_name: str, field_type: str) -> str:
    descriptions = {
        ("BaseResponse", "code"): "业务状态码。成功响应由 `ResultUtils.success()` 固定写入 `200`；失败响应通常来自 `ErrorCode`。",
        ("BaseResponse", "data"): "真正的业务数据载荷，类型由接口返回值决定；失败时通常为 `null`。",
        ("BaseResponse", "message"): "面向调用方的提示信息。成功时为 `ok`，失败时为错误原因。",
        ("ErrorCode", "code"): "错误码数值，用于接口方机器判断错误类型。",
        ("ErrorCode", "message"): "错误码默认文案，用于返回给调用方。",
        ("InputSafetyResult", "safe"): "是否通过输入安全检查。",
        ("InputSafetyResult", "reason"): "拦截或放行原因。",
        ("InputSafetyResult", "riskType"): "风险类型，例如 prompt injection 或 violent intent。",
        ("InputSafetyResult", "hits"): "命中的规则或关键词列表。",
    }
    if (class_name, field_name) in descriptions:
        return descriptions[(class_name, field_name)]
    lower = field_name.lower()
    if lower == "userid" or lower == "user_id":
        return "用户标识，用于隔离不同用户的数据和上下文。"
    if lower == "sessionid" or lower == "session_id":
        return "会话标识，用于定位本轮对话或历史上下文。"
    if lower == "prompt":
        return "用户输入的问题或指令文本。"
    if lower == "debug":
        return "是否开启调试信息返回。"
    if lower in {"answer", "content", "summary", "reason", "message"}:
        return "文本内容字段，承载业务正文、摘要、原因或提示。"
    if lower.endswith("count"):
        return "数量统计字段。"
    if lower.endswith("ms"):
        return "耗时字段，单位通常为毫秒。"
    if field_type.startswith("List<"):
        return "列表字段，承载多条同类型业务对象。"
    if field_type in {"Boolean", "boolean"}:
        return "布尔开关或状态标记。"
    if field_type in {"Integer", "int", "Long", "long", "Double", "double"}:
        return "数值字段。"
    return "业务字段，具体含义由字段名和所属接口上下文决定。"


def json_shape(info: dict) -> list[str]:
    fields = info.get("fields", [])
    if not fields:
        return []
    lines = ["```json", "{"]
    for idx, (name, typ) in enumerate(fields):
        comma = "," if idx < len(fields) - 1 else ""
        if typ in {"String"}:
            value = '""'
        elif typ in {"Boolean", "boolean"}:
            value = "false"
        elif typ in {"Integer", "int", "Long", "long"}:
            value = "0"
        elif typ in {"Double", "double", "BigDecimal"}:
            value = "0.0"
        elif typ.startswith("List<") or typ.startswith("Set<"):
            value = "[]"
        elif typ.startswith("Map<"):
            value = "{}"
        else:
            value = "null"
        lines.append(f'  "{name}": {value}{comma}')
    lines.append("}")
    lines.append("```")
    return lines


def important_annotations(annotations: list[str]) -> list[str]:
    return [a for a in annotations if a not in LOW_VALUE_ANNOTATIONS]


def parse_error_code_groups(text: str) -> list[tuple[str, list[tuple[str, str, str]]]]:
    groups: list[tuple[str, list[tuple[str, str, str]]]] = []
    current_name = "未分组错误码"
    current_items: list[tuple[str, str, str]] = []
    for line in text.splitlines():
        group_match = re.search(r"//\s*=+\s*(.+?)\s*=+", line)
        if group_match:
            if current_items:
                groups.append((current_name, current_items))
                current_items = []
            current_name = group_match.group(1).strip()
            continue
        item_match = re.match(r'\s*([A-Za-z0-9_]+)\((\d+),\s*"([^"]+)"\)\s*(?:,|;)', line)
        if item_match:
            current_items.append(item_match.groups())
    if current_items:
        groups.append((current_name, current_items))
    return groups


def common_response_section(p: Path, info: dict) -> str | None:
    """Write business-first docs for the common response trio."""
    r = rel(p)
    name = info.get("name")
    lines = [f"### `{r}`", ""]

    if name == "BaseResponse":
        lines.extend([
            "**总体说明：** `BaseResponse<T>` 是统一接口响应协议的**最底层数据结构**。它只负责规定所有普通 JSON 接口最终长什么样：外层固定是 `{code, data, message}`。上层的 `ResultUtils` 和 `ErrorCode` 都是在围绕这个底层响应壳做构造和语义填充。",
            "",
            "**分层展开：**",
            "",
            "**在统一响应体系中的位置：**",
            "```text",
            "Controller / GlobalExceptionHandler       调用层：决定这次返回成功还是失败",
            "└── ResultUtils                           构造层：统一创建 BaseResponse",
            "    ├── success(data)                     成功分支：直接填 code=200/data/message=ok",
            "    └── error(ErrorCode)                  失败分支：读取 ErrorCode 的 code/message",
            "        └── ErrorCode                     语义层：定义失败类型、错误码、默认文案",
            "            ↓",
            "        BaseResponse<T>                   协议底座：最终被序列化成 {code,data,message}",
            "```",
            "",
            "**返回格式重点：**",
            "```json",
            "{",
            '  "code": 200,',
            '  "data": {},',
            '  "message": "ok"',
            "}",
            "```",
            "",
            "**失败格式示例：**",
            "```json",
            "{",
            '  "code": 40000,',
            '  "data": null,',
            '  "message": "请求参数错误"',
            "}",
            "```",
            "",
            "**字段含义：**",
            "- `code: int`：业务状态码。成功一般是 `200`；失败时通常来自 `ErrorCode.code`。",
            "- `data: T`：业务数据载荷。成功时放接口真实返回对象；失败时通常是 `null`。",
            "- `message: String`：响应提示。成功时通常是 `ok`；失败时通常来自 `ErrorCode.message` 或上层覆盖文案。",
            "",
            "**底层构造能力：**",
            "- `BaseResponse(int code, T data, String message)`：最完整的底层构造函数，所有字段都由调用方传入。",
            "- `BaseResponse(int code, T data)`：省略 `message` 的简化构造。",
            "- `BaseResponse(ErrorCode errorCode)`：面向失败场景的便捷构造，本质是把 `ErrorCode.code/message` 填进底层响应壳，并把 `data` 固定为 `null`。",
            "",
            "**和上层结构的关系：**",
            "- `BaseResponse` 不决定什么是参数错误、登录错误或系统错误；这些失败语义由 `ErrorCode` 定义。",
            "- `BaseResponse` 不负责让 Controller 写法变简单；这个职责由 `ResultUtils` 承担。",
            "- `BaseResponse` 是最终 JSON 结构的底座；`ErrorCode` 和 `ResultUtils` 都是围绕它的上层封装。",
            "",
            "**技术结构：**",
            f"- 类型：`class` `BaseResponse`；包：`{info.get('package')}`；约 `{info['lines']}` 行。",
            "- 所属逻辑域：通用响应封装模块。",
            "",
        ])
        return "\n".join(lines)

    if name == "ErrorCode":
        groups = parse_error_code_groups(read_text(p))
        lines.extend([
            "**总体说明：** `ErrorCode` 是统一失败响应的**语义层**。它不负责承载接口数据，也不直接代表最终 JSON；它集中枚举“有哪些失败类型”，并为每种失败提供稳定的 `code` 和默认 `message`，再由 `ResultUtils` / `BaseResponse` 转成 `{code,data,message}`。",
            "",
            "**分层展开：**",
            "",
            "**在统一响应体系中的位置：**",
            "```text",
            "ResultUtils.error(ErrorCode.PARAMS_ERROR)  构造层调用",
            "└── ErrorCode.PARAMS_ERROR                 语义层：请求参数错误",
            '    ├── code    = 40000',
            '    └── message = "请求参数错误"',
            "        ↓",
            "    BaseResponse(ErrorCode)                协议底座填充",
            '        └── {"code":40000,"data":null,"message":"请求参数错误"}',
            "```",
            "",
            "**错误码总表，这是本文件的核心：**",
        ])
        for group_name, items in groups:
            lines.append(f"- {group_name}")
            for enum_name, code, message in items:
                lines.append(f"  - `{enum_name}`：`{code}`，`{message}`。")
        lines.extend([
            "",
            "**字段含义：**",
            "- `code: int`：稳定错误码。前端、调用方、日志检索和异常排查都应优先依赖它，而不是依赖文案字符串。",
            "- `message: String`：默认错误文案。可以直接进入 `BaseResponse.message`，也可以在 `ResultUtils.error(errorCode, message)` 中被覆盖。",
            "",
            "**和 BaseResponse / ResultUtils 的关系：**",
            "```text",
            "ErrorCode：定义失败语义",
            "└── ResultUtils：选择某个 ErrorCode 来构造失败响应",
            "    └── BaseResponse：接收 ErrorCode 的 code/message，形成最终响应壳",
            "```",
            "",
            "**技术结构：**",
            f"- 类型：`enum` `ErrorCode`；包：`{info.get('package')}`；约 `{info['lines']}` 行。",
            "- 所属逻辑域：通用响应封装模块。",
            "- 对外读取方法：`getCode()`、`getMessage()`。",
            "",
        ])
        return "\n".join(lines)

    if name == "ResultUtils":
        lines.extend([
            "**总体说明：** `ResultUtils` 是统一响应体系的**上层构造门面**。Controller、Service 或全局异常处理器应该优先调用它，而不是到处 `new BaseResponse(...)`。它负责把“成功数据”或“失败语义 ErrorCode”统一转换成底层 `BaseResponse<T>`。",
            "",
            "**分层展开：**",
            "",
            "**在统一响应体系中的位置：**",
            "```text",
            "Controller / GlobalExceptionHandler       调用层",
            "└── ResultUtils                           构造层：统一入口",
            "    ├── success(data)                     成功：填充 BaseResponse(200,data,ok)",
            "    ├── error(ErrorCode)                  失败：用 ErrorCode 默认 code/message",
            "    ├── error(code,message)               失败：手动 code/message",
            "    └── error(ErrorCode,message)          失败：复用 ErrorCode.code，覆盖 message",
            "        ↓",
            "    BaseResponse<T>                       最终响应壳",
            "```",
            "",
            "**核心方法和最终格式：**",
            "- `success(data)` → `new BaseResponse<>(200, data, \"ok\")` → `{\"code\":200,\"data\":data,\"message\":\"ok\"}`。",
            "- `error(ErrorCode.PARAMS_ERROR)` → `new BaseResponse(errorCode)` → `{\"code\":40000,\"data\":null,\"message\":\"请求参数错误\"}`。",
            "- `error(50001, \"操作失败\")` → `new BaseResponse(code, null, message)` → `{\"code\":50001,\"data\":null,\"message\":\"操作失败\"}`。",
            "- `error(ErrorCode.PARAMS_ERROR, \"自定义提示\")` → 复用 `40000`，但把 `message` 改成上层指定文案。",
            "",
            "**和 BaseResponse / ErrorCode 的关系：**",
            "```text",
            "ResultUtils 是上层门面",
            "├── 成功时：直接给 BaseResponse 填 200、data、ok",
            "└── 失败时：从 ErrorCode 拿 code/message，再交给 BaseResponse",
            "```",
            "",
            "**技术结构：**",
            f"- 类型：`class` `ResultUtils`；包：`{info.get('package')}`；约 `{info['lines']}` 行。",
            "- 所属逻辑域：通用响应封装模块。",
            "- 对外方法：`success()`、`error()`。",
            "",
        ])
        return "\n".join(lines)

    return None


def controller_section(p: Path, info: dict) -> str | None:
    """Write endpoint-first docs for Controllers."""
    r = rel(p)
    name = info.get("name")
    docs = {
        "AdaptiveRagController": {
            "summary": "Adaptive RAG 对话入口 Controller。它不是普通聊天接口，而是把请求交给 `AdaptiveRagOrchestrator`，由后者完成是否检索、检索策略、证据评估、查询改写、记忆注入和引用回答生成。",
            "base": "/rag/adaptive",
            "service": "`AdaptiveRagOrchestrator`",
            "flow": [
                "接收 `AdaptiveRagRequest`。",
                "把 `userId/sessionId` 写入 `MonitorContextHolder`，让模型监控能关联用户和会话。",
                "调用 `adaptiveRagOrchestrator.chat(request)` 执行 Adaptive RAG 主流程。",
                "finally 中清理 `MonitorContextHolder`，避免线程上下文污染。",
            ],
            "endpoints": [
                ("POST", "/rag/adaptive/chat", "`AdaptiveRagRequest` JSON", "`AdaptiveRagResponse`", "执行 Adaptive RAG 问答；`debug=true` 时可返回检索计划、证据评估、记忆上下文、改写记录等调试信息。"),
            ],
        },
        "AgentController": {
            "summary": "ReAct Agent 对话与工具治理入口 Controller。它暴露工具列表、工具审计记录和 Agent 主聊天接口，是 `/api/agent` 能力的 HTTP 边界。",
            "base": "/agent",
            "service": "`ReActAgentOrchestrator`、`ToolRegistry`、`ToolGovernanceService`",
            "flow": [
                "工具相关接口直接读取工具注册表或审计表。",
                "聊天接口接收 `AgentRequest`，把 `userId/sessionId` 写入监控上下文。",
                "调用 `reActAgentOrchestrator.chat(request)`，进入上下文准备、Planner、工具治理、工具执行、RAG/记忆/搜索等 ReAct 主链路。",
                "finally 中清理监控上下文。",
            ],
            "endpoints": [
                ("GET", "/agent/tools", "无", "`List<AgentTool>`", "查看当前启用的 Agent 工具清单，包括工具名、动作类型、风险等级、是否需要确认。"),
                ("GET", "/agent/tools/audit", "Query: `userId?`, `sessionId?`, `limit=20`", "`List<ToolAuditRecord>`", "查看工具治理审计记录，用于排查某次工具调用为什么放行、拦截或要求确认。"),
                ("POST", "/agent/chat", "`AgentRequest` JSON", "`AgentResponse`", "执行 ReAct Agent 主对话，返回答案、最终动作、引用、ReAct trace、耗时、token 和 memoryTrace。"),
            ],
        },
        "AiChatController": {
            "summary": "最基础的 AI Chat Controller，直接把用户 prompt 交给 LangChain4j `AiChat`，提供普通阻塞回答和流式回答。它比 `/agent/chat` 和 `/rag/chat` 更薄，不做 ReAct 工具编排。",
            "base": "无类级 `@RequestMapping`，方法路径直接挂在应用 context-path 下",
            "service": "`AiChat`",
            "flow": [
                "接收 `ChatRequest(sessionId,userId,prompt)`。",
                "写入 `MonitorContextHolder` 以记录模型调用指标归属。",
                "普通接口调用 `aiChat.chat(sessionId, prompt)` 返回字符串。",
                "流式接口调用 `aiChat.streamChat(sessionId, prompt)` 返回 `Flux<String>`，并在流结束时清理上下文。",
            ],
            "endpoints": [
                ("POST", "/chat", "`ChatRequest` JSON", "`String`", "基础非流式聊天。"),
                ("POST", "/streamChat", "`ChatRequest` JSON", "`Flux<String>`", "基础流式聊天，前端 `front/gpt.html` 当前调用的就是这个接口。"),
            ],
        },
        "KnowledgeController": {
            "summary": "手动新增知识点 Controller。它把一个问答对写入 RAG 知识库链路，适合快速补充小块知识，而不是批量导入文档。",
            "base": "无类级 `@RequestMapping`",
            "service": "`DocumentIngestionService`",
            "flow": [
                "接收 `KnowledgeRequest(question, answer, sourceName)`。",
                "调用 `documentIngestionService.ingestQa(...)` 把问答对切成片段并写入向量库/引用溯源表。",
                "成功返回中文字符串，包含生成片段数量。",
                "失败时捕获异常并返回 `插入失败：...` 字符串。",
            ],
            "endpoints": [
                ("POST", "/insert", "`KnowledgeRequest` JSON", "`String`", "新增单条 QA 知识点并同步到 RAG 检索体系。"),
            ],
        },
        "MemoryController": {
            "summary": "Memory Agent 调试和管理 Controller。它覆盖会话摘要、记忆上下文、长期记忆写入/纠错/查询/禁用、反思记忆和 Agent 记忆链路追踪，是观察 Memory Agent 行为的主要 HTTP 入口。",
            "base": "/memory",
            "service": "`SessionSummaryService`、`LongTermMemoryService`、`MemoryContextBuilder`、`ReflectiveMemoryService`、`MemoryAgent`",
            "flow": [
                "摘要接口读写 `session_summary`。",
                "上下文接口调用 `MemoryContextBuilder` 组合摘要和长期记忆。",
                "长期记忆接口调用 `LongTermMemoryService` 写入、纠错、查询和禁用记忆。",
                "反思接口调用 `ReflectiveMemoryService` 写入 REFLECTION 类型记忆。",
                "`/agent/context` 返回 `MemoryTrace`，能看到 decision、context、summaryRefreshed、reflection、costMs。",
            ],
            "endpoints": [
                ("GET", "/memory/session/summary", "Query: `userId`, `sessionId`", "`SessionSummary`", "查询某用户某会话摘要；不存在时返回空摘要对象。"),
                ("POST", "/memory/session/summarize", "`SessionSummaryRequest` JSON", "`SessionSummary`", "立即刷新会话摘要。"),
                ("GET", "/memory/context", "Query: `userId`, `sessionId`, `prompt?`", "`MemoryContext`", "按查询参数构建本轮可注入模型的记忆上下文。"),
                ("POST", "/memory/context", "`MemoryContextRequest` JSON", "`MemoryContext`", "按请求体构建记忆上下文。"),
                ("POST", "/memory/write", "`MemoryWriteRequest` JSON", "`MemoryItem`", "手动写入一条长期记忆。"),
                ("POST", "/memory/correct", "`MemoryCorrectionRequest` JSON", "`MemoryCorrectionResult`", "纠错记忆：先禁用同用户同类型 ACTIVE 旧记忆，再写入修正后的新记忆。"),
                ("GET", "/memory/user/{userId}", "Path: `userId`; Query: `memoryType?`, `limit=10`", "`List<MemoryItem>`", "查看用户长期记忆列表。"),
                ("GET", "/memory/item/{memoryId}", "Path: `memoryId`", "`MemoryItem`", "按 memoryId 查看单条记忆；不存在会抛异常。"),
                ("POST", "/memory/disable/{memoryId}", "Path: `memoryId`", "`Boolean`", "禁用指定长期记忆。"),
                ("POST", "/memory/reflection", "`ReflectionRequest` JSON", "`ReflectionResult`", "写入反思记忆。"),
                ("POST", "/memory/agent/context", "`MemoryAgentRequest` JSON", "`MemoryTrace`", "执行完整 Memory Agent 读上下文流程，返回决策、上下文、摘要刷新和反思追踪。"),
            ],
        },
        "RagChatController": {
            "summary": "传统 RAG 问答 Controller。它把用户问题交给 `RagQueryService`，执行混合检索、重排、token 预算、Prompt 构造、模型回答和引用返回。",
            "base": "/rag",
            "service": "`RagQueryService`",
            "flow": [
                "接收 `ChatRequest(sessionId,userId,prompt)`。",
                "写入监控上下文。",
                "调用 `ragQueryService.chatWithCitations(sessionId, prompt)`。",
                "返回 `RagQueryResponse`，包含 answer、citations、hit、retrievedCount、candidateCount、耗时和上下文统计。",
            ],
            "endpoints": [
                ("POST", "/rag/chat", "`ChatRequest` JSON", "`RagQueryResponse`", "执行带引用的传统 RAG 问答。"),
            ],
        },
        "RagDocumentController": {
            "summary": "RAG 文档入库 Controller。它负责通过 HTTP 触发指定路径文档入库，并做路径存在性、真实路径和允许目录校验。这个 Controller 明确使用 `BaseResponse` / `ResultUtils` / `ErrorCode` 统一响应体系。",
            "base": "/rag/documents",
            "service": "`DocumentIngestionService`",
            "flow": [
                "接收 `DocumentIngestRequest(path)`。",
                "校验 request 和 path 不能为空，否则抛 `BusinessException(ErrorCode.PARAMS_ERROR)`。",
                "校验路径存在，否则抛 `BusinessException(ErrorCode.NOT_FOUND_ERROR)`。",
                "解析真实路径，并在默认配置下限制必须位于 `rag.docs-path` 目录内，否则抛 `NO_AUTH_ERROR`。",
                "调用 `documentIngestionService.ingestDocumentsFromPath(realPath)`。",
                "用 `ResultUtils.success(DocumentIngestResponse)` 返回统一 `{code,data,message}`。",
            ],
            "endpoints": [
                ("POST", "/rag/documents/ingest", "`DocumentIngestRequest` JSON，例如 `{\"path\":\"src/main/resources/docs\"}`", "`BaseResponse<DocumentIngestResponse>`", "触发文档入库，返回真实路径、生成 chunk 数和提示信息。"),
            ],
        },
    }
    spec = docs.get(name)
    if not spec:
        return None
    lines = [f"### `{r}`", ""]
    lines.append(f"**总体说明：** {spec['summary']}")
    lines.append("")
    lines.append("**分层展开：**")
    lines.append("")
    lines.append("**接口总览：**")
    lines.append(f"- 类级路径：`{spec['base']}`。")
    lines.append(f"- 主要调用对象：{spec['service']}。")
    lines.append("- 接口列表：")
    lines.append("")
    lines.append("| 方法 | 完整路径 | 入参 | 返回 | 作用 |")
    lines.append("| --- | --- | --- | --- | --- |")
    for method, path, req, resp, purpose in spec["endpoints"]:
        lines.append(f"| `{method}` | `{path}` | {req} | {resp} | {purpose} |")
    lines.append("")
    lines.append("**业务调用链：**")
    lines.append("```text")
    lines.append(f"{name}")
    for i, step in enumerate(spec["flow"]):
        branch = "└──" if i == len(spec["flow"]) - 1 else "├──"
        lines.append(f"{branch} {step}")
    lines.append("```")
    lines.append("")
    lines.append("**技术结构：**")
    lines.append(f"- 类型：`{info['kind']}` `{info['name']}`；包：`{info.get('package')}`；约 `{info['lines']}` 行。")
    lines.append("- 所属逻辑域：HTTP Controller 模块。")
    if info.get("fields"):
        fields = "；".join(f"`{n}: {t}`" for n, t in info["fields"])
        lines.append(f"- 注入依赖：{fields}。")
    if info.get("methods"):
        methods = "、".join(f"`{m}()`" for m in info["methods"])
        lines.append(f"- Java 方法：{methods}。")
    lines.append("")
    return "\n".join(lines)


def summarize_non_java(p: Path) -> tuple[str, list[str]]:
    r = rel(p)
    text = read_text(p, 12000)
    points: list[str] = []
    if r == "pom.xml":
        deps = re.findall(r"<artifactId>([^<]+)</artifactId>", text)
        key = [d for d in deps if d not in {"spring-boot-starter-parent"}]
        return "Maven 项目描述文件，声明 Spring Boot 3.5.13、Java 17、LangChain4j、PgVector、Redis、JDBC、邮件、Actuator、Prometheus、PDF/Office 解析和 OpenAPI 等依赖。", [f"关键依赖数量：{len(key)}；构建插件包含 Maven Compiler 与 Spring Boot Maven Plugin。"]
    if r == "README.md":
        return "项目总 README，面向使用者说明 InfiniteChat-Agent 的定位、核心能力、技术栈、架构图、本地启动方式、Demo 流程和简历表述。", ["它是理解业务边界和演示路径的第一入口。"]
    if r == "docs/README.md":
        return "docs 目录索引，按 Roadmap、RAG、ReAct、Adaptive RAG、Memory、Tool Governance 和 Input Guardrail 组织既有文档与 Postman 集合。", ["它负责把阶段文档和测试集合串成导航。"]
    if r == "src/main/resources/application.yml":
        return "Spring Boot 主配置文件，定义端口、上下文路径、MySQL、Redis、邮件、PgVector、DashScope、MCP、Web Search、RAG、Memory、Agent、Actuator 等运行参数。", ["这是运行行为最权威的静态配置来源，默认服务地址为 `http://localhost:10010/api`。"]
    if r.endswith(".yml") or r.endswith(".yaml"):
        return "YAML 配置文件，提供运行时或工具配置。", []
    if r.endswith(".json"):
        try:
            obj = json.loads(text)
            if "item" in obj or "info" in obj:
                return "Postman 集合或 JSON 测试资产，用于复现对应模块 API 调用。", [f"顶层字段：{', '.join(list(obj)[:8])}。"]
            return "JSON 示例/数据文件，用结构化形式表达接口、调试或样例数据。", [f"顶层字段：{', '.join(list(obj)[:8]) if isinstance(obj, dict) else '数组'}。"]
        except Exception:
            return "JSON 文件，当前内容可能包含注释或非标准片段，主要作为测试/示例资产。", []
    if r.endswith(".md"):
        title = re.search(r"^#\s+(.+)", text, re.M)
        headings = re.findall(r"^#{1,3}\s+(.+)", text, re.M)
        summary = f"Markdown 文档" + (f"《{title.group(1)}》" if title else "") + "，记录对应模块的设计、路线、部署或测试说明。"
        if headings:
            points.append("主要章节：" + "、".join(headings[:8]) + "。")
        return summary, points
    if r.endswith(".py"):
        funcs = re.findall(r"^def\s+(\w+)\s*\(", text, re.M)
        return "Python 辅助脚本，用于本地启动或模拟外部能力。", [f"函数：{', '.join(funcs[:8]) or '无显式函数'}。"]
    if r.endswith(".html"):
        ids = re.findall(r'id="([^"]+)"', text)
        funcs = re.findall(r"function\s+(\w+)\s*\(", text)
        return "前端静态 HTML 页面，提供千言 AI 助手的会话 UI、主题切换、会话列表、本地 userId 和流式对话请求。", [f"关键 DOM id：{', '.join(ids[:12])}。", f"关键脚本函数：{', '.join(funcs[:12])}。"]
    if r.endswith(".txt"):
        return "纯文本资源文件。", [text.strip().splitlines()[0][:120] + "。" if text.strip() else "内容为空。"]
    if r.endswith(".pdf"):
        return "内置 PDF 知识库文档，供 RAG 入库使用。", ["通常由 RagDataLoader/DocumentIngestionService 读取并切分为检索片段。"]
    if p.name in {"mvnw", "mvnw.cmd"}:
        return "Maven Wrapper 启动脚本，用于在不同平台上以一致方式执行 Maven 构建和 Spring Boot 启动。", []
    if p.name.startswith("."):
        return "工程元数据/忽略规则文件，服务于 Git、IDE 或本地环境示例。", []
    return "项目文件。", []


def file_section(p: Path) -> str:
    r = rel(p)
    title = r
    lines = []
    lines.append(f"### `{r}`")
    if p.suffix == ".java":
        info = parse_java(p)
        common_doc = common_response_section(p, info)
        if common_doc:
            return common_doc
        controller_doc = controller_section(p, info)
        if controller_doc:
            return controller_doc
        module = MODULE_NOTES.get(info.get("package", ""), info.get("package", ""))
        dto = is_dto_file(r, info)
        lines.append("")
        lines.append(f"**总体说明：** {hint_for_java(info, r)}")
        lines.append("")
        lines.append("**分层展开：**")
        if dto and info["fields"]:
            lines.append("")
            lines.append("**接口/数据格式重点：**")
            lines.extend(json_shape(info))
            lines.append("")
            lines.append("**字段含义：**")
            for name, typ in info["fields"]:
                lines.append(f"- `{name}: {typ}`：{field_description(info['name'], name, typ)}")
            lines.append("")
            lines.append("**技术结构：**")
        lines.append(f"- 类型：`{info['kind']}` `{info['name']}`；包：`{info.get('package') or '默认包'}`；约 `{info['lines']}` 行。")
        if module:
            lines.append(f"- 所属逻辑域：{module}。")
        anns = important_annotations(info["annotations"])
        if anns:
            lines.append("- 关键注解：" + "、".join(f"`@{a}`" for a in anns[:10]) + "。")
        elif info["annotations"] and not dto:
            lines.append("- 结构注解：" + "、".join(f"`@{a}`" for a in info["annotations"][:10]) + "。")
        if info["fields"] and not dto:
            field_text = "；".join(f"`{name}: {typ}`" for name, typ in info["fields"][:16])
            more = "；……" if len(info["fields"]) > 16 else ""
            lines.append(f"- 关键字段：{field_text}{more}。")
        if info["methods"]:
            method_text = "、".join(f"`{m}()`" for m in info["methods"][:18])
            more = "、……" if len(info["methods"]) > 18 else ""
            lines.append(f"- 关键方法：{method_text}{more}。")
        if info["enum_values"]:
            lines.append("- 枚举值：" + "、".join(f"`{v}`" for v in info["enum_values"]) + "。")
        dep_hints = []
        imports = info.get("imports", [])
        if any("JdbcTemplate" in x for x in imports):
            dep_hints.append("依赖 JDBC，通常会读写 MySQL/RAG 元数据表")
        if any("RedisChatMemoryStore" in x for x in imports):
            dep_hints.append("依赖 Redis Chat Memory，参与短期会话历史")
        if any("ChatModel" in x or "StreamingChatModel" in x for x in imports):
            dep_hints.append("依赖 LangChain4j 模型接口")
        if any("Embedding" in x for x in imports):
            dep_hints.append("依赖 embedding/向量检索能力")
        if any("RestClient" in x for x in imports):
            dep_hints.append("会发起 HTTP 调用外部服务")
        if any("ObjectMapper" in x for x in imports):
            dep_hints.append("包含 JSON 序列化/解析逻辑")
        if dep_hints:
            lines.append("- 依赖提示：" + "；".join(dep_hints) + "。")
    else:
        summary, points = summarize_non_java(p)
        lines.append("")
        lines.append(f"**总体说明：** {summary}")
        lines.append("")
        lines.append("**分层展开：**")
        lines.append(f"- 文件类型：`{p.suffix or p.name}`；大小约 {p.stat().st_size} 字节。")
        for pt in points:
            lines.append(f"- {pt}")
        if r.startswith("docs/") and r.endswith(".postman_collection.json"):
            lines.append("- 使用方式：导入 Postman 后可按模块验证接口链路，适合作为手工回归测试资产。")
        if r.startswith("src/main/resources/docs/"):
            lines.append("- 业务作用：作为内置知识库源文件，启动加载或手动入库后成为 RAG 可引用证据。")
    lines.append("")
    return "\n".join(lines)


def build_tree(paths: Iterable[str]) -> str:
    tree = {}
    for path in paths:
        node = tree
        parts = path.split("/")
        for part in parts:
            node = node.setdefault(part, {})
    def render(node: dict, prefix: str = "") -> list[str]:
        out=[]
        items=sorted(node.items(), key=lambda kv: (bool(kv[1]) is False, kv[0]))
        # Actually keep dirs then files
        items=sorted(node.items(), key=lambda kv: (0 if kv[1] else 1, kv[0]))
        for i,(name,child) in enumerate(items):
            last=i==len(items)-1
            branch="└── " if last else "├── "
            out.append(prefix+branch+name)
            if child:
                out.extend(render(child, prefix+("    " if last else "│   ")))
        return out
    return "\n".join(render(tree))


def group_by_package(files: list[Path]) -> dict[str, list[Path]]:
    grouped=defaultdict(list)
    for p in files:
        if p.suffix == ".java":
            info=parse_java(p)
            grouped[info.get("package") or "默认包"].append(p)
        else:
            parent=Path(rel(p)).parent.as_posix()
            grouped[parent].append(p)
    return dict(sorted(grouped.items()))


def write_category_doc(cat: str, files: list[Path]) -> None:
    title=CATEGORY_TITLES[cat]
    md=[]
    md.append(f"# {title}")
    md.append("")
    md.append(f"**总体说明：** {CATEGORY_INTROS[cat]}")
    md.append("")
    md.append("## 逻辑树")
    md.append("")
    md.append("```text")
    md.append(build_tree(rel(p) for p in files))
    md.append("```")
    md.append("")
    md.append("## 逐文件详细说明")
    md.append("")
    grouped=group_by_package(files)
    for group, ps in grouped.items():
        md.append(f"## {group}")
        md.append("")
        md.append(f"**总体说明：** 本小节覆盖 `{group}` 下的文件，先说明每个文件的职责，再列出其字段、方法、配置或资源用途。")
        md.append("")
        for p in sorted(ps, key=rel):
            md.append(file_section(p))
    (OUT/f"{cat}.md").write_text("\n".join(md).rstrip()+"\n", encoding="utf-8")


def write_index(files_by_cat: dict[str, list[Path]], all_files: list[Path]) -> None:
    java_main=sum(1 for p in all_files if rel(p).startswith("src/main/java/") and p.suffix==".java")
    java_test=sum(1 for p in all_files if rel(p).startswith("src/test/java/") and p.suffix==".java")
    docs=sum(1 for p in all_files if rel(p).startswith("docs/"))
    resources=sum(1 for p in all_files if rel(p).startswith("src/main/resources/"))
    md=[]
    md.append("# Agent 项目逻辑树与逐文件说明")
    md.append("")
    md.append("**总体说明：** 本文档从当前 `./agent` 工作树生成，按逻辑域组织项目结构，并在各子文档中对每个纳入范围的文件做“先总后分”的逐文件说明。它适合作为新人接手项目、梳理重构边界、定位模块职责和排查链路依赖的入口。")
    md.append("")
    md.append("## 覆盖范围")
    md.append("")
    md.append("- 纳入：根目录工程文件、`src/main/java`、`src/main/resources`、`src/test/java`、既有 `docs`、`scripts`。")
    md.append("- 排除：`target/` 构建产物、`.git/`、`.idea/`、`.settings/`、`.mvn/`、`.DS_Store`、本目录生成文档。")
    md.append(f"- 当前纳入文件总数：{len(all_files)}；主源码 Java：{java_main}；测试 Java：{java_test}；资源文件：{resources}；既有 docs 文件：{docs}。")
    md.append("")
    md.append("## 顶层逻辑树")
    md.append("")
    md.append("```text")
    for cat in CATEGORY_ORDER:
        count=len(files_by_cat.get(cat, []))
        md.append(f"{cat}  {CATEGORY_TITLES[cat]}  ({count} files)")
    md.append("```")
    md.append("")
    md.append("## 阅读顺序建议")
    md.append("")
    md.append("1. 先读 `01-root-and-build.md` 和 `02-runtime-config-and-resources.md`，理解项目如何启动、依赖哪些外部组件。")
    md.append("2. 再读 `04-agent-react-and-tooling.md`，掌握 ReAct Agent 的主链路。")
    md.append("3. 并行阅读 `05-memory-agent.md` 与 `06-rag-and-adaptive-rag.md`，理解记忆和知识库如何参与回答。")
    md.append("4. 最后读 `03-api-and-common-infrastructure.md`、`07-model-observability-and-ai-chat.md` 和 `09-tests.md`，补齐接口、配置、监控和测试视角。")
    md.append("")
    md.append("## 分类文档索引")
    md.append("")
    for cat in CATEGORY_ORDER:
        files=files_by_cat.get(cat, [])
        if not files:
            continue
        md.append(f"- [{CATEGORY_TITLES[cat]}](./{cat}.md)：{len(files)} 个文件。")
    md.append("")
    md.append("## 全局架构树")
    md.append("")
    md.append("```text")
    md.append("InfiniteChat-Agent")
    md.append("├── HTTP/API 层：controller + common + exception + guardrail")
    md.append("├── ReAct Agent 层：agent/orchestrator + planner + context + tool + governance + dto")
    md.append("├── Memory 层：memory services + memory dto + schema initializer")
    md.append("├── RAG 层：ingestion + vector/keyword/hybrid search + rerank + citation")
    md.append("├── Adaptive RAG 层：retrieval planner + evidence evaluator + query rewrite + debug dto")
    md.append("├── 模型与工具层：config + ai + tool + monitor + job")
    md.append("├── 运行资源：application.yml + system-prompt + docs corpus + front/gpt.html")
    md.append("└── 测试与文档：src/test + docs + postman + scripts")
    md.append("```")
    md.append("")
    md.append("## 关键调用链")
    md.append("")
    md.append("### ReAct Agent 对话链路")
    md.append("")
    md.append("```text")
    md.append("AgentController.chat")
    md.append("└── ReActAgentOrchestrator.chat")
    md.append("    ├── AgentContextManager.prepare")
    md.append("    │   ├── MemoryAgent.readContext")
    md.append("    │   ├── RedisChatMemoryStore 读取历史")
    md.append("    │   └── 生成 AgentContext(memoryText/historyText/token flags)")
    md.append("    ├── LlmAgentPlanner 或 RuleBasedAgentPlanner 生成 AgentPlan")
    md.append("    ├── ToolGovernanceService.evaluate")
    md.append("    ├── 根据 AgentActionType 执行 RAG/时间/记忆/邮件/Web Search/直接回答")
    md.append("    ├── AgentContextManager.saveTurn")
    md.append("    └── AgentContextManager.afterAnswer 触发摘要/反思")
    md.append("```")
    md.append("")
    md.append("### Adaptive RAG 链路")
    md.append("")
    md.append("```text")
    md.append("AdaptiveRagController.chat")
    md.append("└── AdaptiveRagOrchestrator.chat")
    md.append("    ├── RetrievalPlanner 生成 RetrievalPlan")
    md.append("    ├── MemoryAgent.readContext 注入记忆")
    md.append("    ├── VectorSearch / KeywordSearch / HybridSearch")
    md.append("    ├── RerankService 重排序")
    md.append("    ├── EvidenceEvaluator 判断证据充分性")
    md.append("    ├── QueryRewriteService 必要时补充检索")
    md.append("    └── ChatModel 生成带引用回答和 debug 信息")
    md.append("```")
    md.append("")
    md.append("### Memory Agent 链路")
    md.append("")
    md.append("```text")
    md.append("MemoryAgent.readContext")
    md.append("├── RuleBasedMemoryPlanner.plan")
    md.append("├── MemoryContextBuilder.build")
    md.append("│   ├── SessionSummaryService.findSummary")
    md.append("│   └── MemoryRetrievalService.retrieveRelevantMemories")
    md.append("└── 返回 MemoryTrace(decision/context/costMs)")
    md.append("")
    md.append("MemoryAgent.afterAnswer")
    md.append("├── SessionSummaryService.refreshIfNeeded")
    md.append("└── ReflectiveMemoryService.reflect")
    md.append("```")
    md.append("")
    md.append("## 文件覆盖索引")
    md.append("")
    md.append("下面列出每个文件所在的分类文档，方便反查。")
    md.append("")
    for cat in CATEGORY_ORDER:
        files=files_by_cat.get(cat, [])
        if not files:
            continue
        md.append(f"### {CATEGORY_TITLES[cat]}")
        md.append("")
        for p in files:
            md.append(f"- `{rel(p)}` → [`{cat}.md`](./{cat}.md)")
        md.append("")
    (OUT/"README.md").write_text("\n".join(md).rstrip()+"\n", encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    all_files=included_files()
    files_by_cat={cat: [] for cat in CATEGORY_ORDER}
    for p in all_files:
        files_by_cat.setdefault(category_for(rel(p)), []).append(p)
    for cat, files in files_by_cat.items():
        files.sort(key=rel)
    write_index(files_by_cat, all_files)
    for cat in CATEGORY_ORDER:
        if files_by_cat.get(cat):
            write_category_doc(cat, files_by_cat[cat])
    manifest={
        "generatedForRoot": str(ROOT),
        "fileCount": len(all_files),
        "categories": {cat: [rel(p) for p in files_by_cat.get(cat, [])] for cat in CATEGORY_ORDER},
    }
    (OUT/"coverage-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f"Generated {len(all_files)} file entries into {OUT}")

if __name__ == "__main__":
    main()
