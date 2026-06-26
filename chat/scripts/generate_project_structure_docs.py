#!/usr/bin/env python3
"""Generate logic-tree project documentation for the InfiniteChat chat project.

The generator reads the current multi-module worktree and writes Markdown under
`docs/project-structure/`. It excludes generated/local-only folders and gives one
section per included file, grouped by root project and microservice module.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "project-structure"

EXCLUDED_PARTS = {".git", "target", ".idea", ".mvn"}
EXCLUDED_NAMES = {".DS_Store"}

MODULE_ORDER = [
    "root-and-build",
    "AuthenticationService",
    "GateWay",
    "RealTimeCommunicationService",
    "MessagingService",
    "OfflineDataStoreService",
    "ContactService",
    "MomentService",
]

MODULE_TITLES = {
    "root-and-build": "根工程、构建与环境入口",
    "AuthenticationService": "AuthenticationService 认证、用户与上传授权服务",
    "GateWay": "GateWay 网关、路由与负载均衡服务",
    "RealTimeCommunicationService": "RealTimeCommunicationService 实时通信与 WebSocket 推送服务",
    "MessagingService": "MessagingService 消息发送、红包与出站一致性服务",
    "OfflineDataStoreService": "OfflineDataStoreService 离线消息存储与拉取服务",
    "ContactService": "ContactService 好友、群聊、会话与联系人服务",
    "MomentService": "MomentService 朋友圈动态、点赞评论与通知服务",
}

MODULE_INTROS = {
    "root-and-build": "这一组描述 InfiniteChat 聚合工程如何组织 7 个微服务模块，以及本地环境变量、Git 忽略规则、IDE 元数据和文档生成脚本。它不直接处理业务请求，但决定项目如何构建、启动、协作和重新生成本文档。",
    "AuthenticationService": "该服务负责用户认证与公共能力，覆盖注册、密码/验证码登录、JWT 校验、验证码发送、头像更新、COS 上传 URL 和用户余额初始化等入口。它是用户身份进入系统的起点。",
    "GateWay": "该服务是系统统一入口，基于 Spring Cloud Gateway 和 Nacos 服务发现把外部路径路由到认证、联系人、消息、离线、朋友圈和实时通信服务，同时包含自定义一致性哈希负载均衡与 JWT 工具。",
    "RealTimeCommunicationService": "该服务承载 Netty WebSocket 长连接、在线推送、ACK 重试、心跳、登出、路由 TTL 和内部推送接口。它把 HTTP 服务产生的消息或通知转成面向在线用户的实时帧。",
    "MessagingService": "该服务处理发送聊天消息、红包发送/领取/查询、余额变更、消息出站表和 Kafka 投递。它位于业务消息生产侧，既写数据库，也负责向实时或离线链路转发。",
    "OfflineDataStoreService": "该服务消费 Kafka 消息并持久化离线消息，提供用户上线后按时间拉取离线会话与消息明细的接口。它补齐用户不在线时的可靠消息存储。",
    "ContactService": "该服务处理联系人和群会话生命周期，包括搜索用户、好友申请、通过/拒绝申请、删除/拉黑好友、创建/邀请/退出/踢出群聊、群管理员设置和推送新会话通知。",
    "MomentService": "该服务处理朋友圈动态，包括发布、删除、列表查询、点赞、取消点赞、评论、删除评论和通知实时服务。它复用用户与好友关系数据来控制动态可见性和推送范围。",
}

LAYER_ORDER = [
    "application",
    "controller",
    "service",
    "service-impl",
    "mapper",
    "model",
    "data-dto",
    "constants",
    "config",
    "exception",
    "utils",
    "websocket",
    "route-feign-consumer",
    "common",
    "resources-config",
    "resources-mapper",
    "resources-sql",
    "resources-static",
    "tests",
    "module-build",
    "other",
]

LAYER_TITLES = {
    "application": "启动入口",
    "controller": "HTTP Controller 边界",
    "service": "服务接口",
    "service-impl": "服务实现",
    "mapper": "MyBatis Mapper 接口",
    "model": "数据库实体与业务模型",
    "data-dto": "请求响应 DTO 与传输对象",
    "constants": "常量与枚举",
    "config": "配置、拦截器与框架适配",
    "exception": "异常体系与统一异常处理",
    "utils": "工具类与外部客户端",
    "websocket": "WebSocket / Netty 长连接组件",
    "route-feign-consumer": "跨服务调用、路由与消息消费",
    "common": "通用响应与公共消息结构",
    "resources-config": "运行配置资源",
    "resources-mapper": "MyBatis XML 映射",
    "resources-sql": "SQL 脚本",
    "resources-static": "静态页面资源",
    "tests": "测试代码",
    "module-build": "模块构建与忽略规则",
    "other": "其他文件",
}

METHOD_IGNORE = {"if", "for", "while", "switch", "catch", "return", "new", "throw", "else"}

MODULE_KEYWORDS = {
    "AuthenticationService": ["认证", "注册", "登录", "JWT", "验证码", "用户", "头像", "上传 URL", "COS", "余额初始化"],
    "GateWay": ["网关", "路由", "Nacos", "负载均衡", "一致性哈希", "JWT", "跨域", "WebSocket 代理"],
    "RealTimeCommunicationService": ["实时通信", "Netty", "WebSocket", "在线推送", "ACK", "心跳", "路由 TTL", "通知"],
    "MessagingService": ["消息发送", "红包", "余额", "Kafka", "出站表", "防重复提交", "会话", "用户关系"],
    "OfflineDataStoreService": ["离线消息", "Kafka 消费", "消息持久化", "离线拉取", "会话聚合"],
    "ContactService": ["好友", "好友申请", "群聊", "会话", "成员管理", "拉黑", "踢人", "推送通知"],
    "MomentService": ["朋友圈", "动态", "点赞", "评论", "好友可见", "动态通知"],
}

BUSINESS_HINTS = {
    "AuthenticationServiceApplication": "认证服务启动类，启动用户认证、公共验证码、上传授权和用户资料相关能力。",
    "UserController": "用户接口控制器，暴露注册、登录、验证码登录和头像更新等用户身份相关 API。",
    "CommonController": "公共能力控制器，提供邮件验证码、验证码校验和 COS 上传 URL 获取入口。",
    "UserServiceImpl": "用户服务实现，处理注册、登录、验证码登录、用户已注册校验、头像更新和余额初始化。",
    "CommonServiceImpl": "公共服务实现，负责验证码发送/写入 Redis、邮件发送和上传 URL 生成。",
    "JwtHandler": "认证服务请求拦截器，解析 Authorization token 并拒绝未授权请求。",
    "JwtUtil": "JWT 工具，负责 token 生成、解析和 Bearer token 提取。",
    "OSSUtils": "腾讯 COS 上传下载工具，生成预签名上传 URL 和公开访问 URL。",
    "ResendMailClient": "Resend 邮件 HTTP 客户端，用 OkHttp 发送文本邮件。",
    "GateWayApplication": "网关服务启动类，启动 Spring Cloud Gateway 路由入口。",
    "NettyConsistentHashLoadBalancer": "自定义 Netty 服务负载均衡器，用一致性哈希将 WebSocket 请求路由到稳定实例。",
    "ConsistentHashRing": "一致性哈希环实现，管理虚拟节点与服务实例选择。",
    "GatewayJwtUtil": "网关侧 JWT 工具，用于解析 token 并为路由/负载均衡提供用户维度信息。",
    "NettyLoadBalancerConfiguration": "网关负载均衡配置，把自定义 Netty 负载均衡器接入 Spring Cloud LoadBalancer。",
    "RealTimeCommunicationServiceApplication": "实时通信服务启动类，同时开启定时任务用于 ACK 重试等后台扫描。",
    "NettyServer": "Netty WebSocket 服务端配置和生命周期管理，注册握手、认证、文本帧处理和连接关闭逻辑。",
    "MessageInboundHandler": "WebSocket 入站处理器，处理 ACK、登出、心跳、非法消息和连接上下线。",
    "ChannelManager": "在线用户与 Netty Channel 双向映射管理器。",
    "AckMessageManager": "待 ACK 消息管理器，记录未确认帧并按定时任务重试或移除。",
    "NettyMessageService": "实时推送服务实现，面向在线用户发送消息、朋友圈通知、好友申请和新会话通知。",
    "RcvMsgServiceImpl": "接收消息服务实现，把 HTTP 收到的消息请求转交 Netty 推送链路。",
    "MessagingServiceApplication": "消息服务启动类，启动消息发送、红包和出站一致性能力。",
    "SendMsgController": "聊天消息发送控制器，接收客户端发消息请求并返回消息发送结果。",
    "RedPacketController": "红包控制器，提供发红包、领红包和查红包详情等接口。",
    "MessageServiceImpl": "消息服务实现，保存消息、构造推送体、校验会话成员并驱动实时/离线投递。",
    "RedPacketServiceImpl": "红包发送服务实现，处理红包创建、余额扣减、消息体构造和事务一致性。",
    "RedPacketReceiveServiceImpl": "红包领取服务实现，控制领取资格、金额分配、余额入账和领取记录。",
    "GetRedPacketServiceImpl": "红包详情查询服务实现，组装红包领取状态和领取用户列表。",
    "KafkaOutboxServiceImpl": "消息出站表服务实现，负责保存、重试和标记 Kafka 投递状态。",
    "PreventDuplicateSubmitAspect": "防重复提交切面，基于注解和 Redis/锁逻辑限制短时间重复请求。",
    "RedPacketExpireListener": "红包过期扫描组件，定期处理过期红包和剩余金额回退。",
    "RealtimeRouteService": "实时服务路由定位组件，基于用户在线路由寻找可用 Netty 实例。",
    "OfflineDataStoreServiceApplication": "离线存储服务启动类，启动 Kafka 消费和离线消息查询能力。",
    "MessageConsumer": "Kafka 消费者，监听消息 topic 并把消息写入离线存储。",
    "MessageController": "离线消息控制器，提供按用户和时间拉取离线消息的接口。",
    "MessageServiceImpl": "消息服务实现，负责离线消息保存、按会话聚合和消息明细查询。",
    "ContactServiceApplication": "联系人服务启动类，启动好友、群聊、会话和推送通知相关能力。",
    "ContactController": "联系人综合控制器，集中暴露搜索用户、好友申请、申请处理、好友详情、群聊创建和成员管理接口。",
    "FriendServiceImpl": "好友服务实现，处理搜索、好友详情、删除好友、拉黑好友等核心好友关系逻辑。",
    "ApplyFriendServiceImpl": "好友申请服务实现，处理申请创建、未读数量、申请列表和通过/拒绝申请。",
    "SessionServiceImpl": "会话服务实现，维护私聊/群聊 session 与用户会话关系。",
    "GroupServiceImpl": "群组服务实现，创建群、邀请成员并生成群会话。",
    "GroupAdminServiceImpl": "群管理员服务实现，设置或取消群管理员。",
    "GetGroupMembersServiceImpl": "群成员查询服务实现，读取群成员列表和成员信息。",
    "KickGroupServiceImpl": "踢出群成员服务实现，校验操作者权限并修改成员关系。",
    "ExitGroupServiceImpl": "退出群聊服务实现，处理成员主动退出群聊。",
    "PushServiceImpl": "联系人服务推送实现，通过 HTTP 调用实时通信服务发送申请或新会话通知。",
    "MomentServiceApplication": "朋友圈服务启动类，启动动态、点赞、评论和通知相关能力。",
    "MomentController": "朋友圈控制器，暴露发动态、删动态、列表、点赞、取消点赞、评论和删评论接口。",
    "MomentServiceImpl": "朋友圈动态服务实现，处理动态创建、删除、列表查询和动态可见性。",
    "MomentLikeServiceImpl": "点赞服务实现，处理点赞和取消点赞。",
    "MomentCommentServiceImpl": "评论服务实现，处理评论创建和删除。",
    "MomentNotificationServiceImpl": "朋友圈通知服务实现，向实时通信服务推送动态通知。",
    "SendOkHttpRequest": "OkHttp 调用工具，用于跨服务发送 HTTP 请求。",
}

QUALIFIED_BUSINESS_HINTS = {
    ("AuthenticationService", "UserServiceImpl"): "用户服务实现，处理注册、登录、验证码登录、用户已注册校验、头像更新和余额初始化。",
    ("ContactService", "UserServiceImpl"): "联系人服务中的用户查询实现，围绕用户资料、状态和搜索场景为好友/群聊流程提供用户数据。",
    ("MomentService", "UserServiceImpl"): "朋友圈服务中的用户查询实现，为动态列表、评论点赞展示和通知组装提供用户资料。",
    ("OfflineDataStoreService", "UserServiceImpl"): "离线存储服务中的用户服务实现，作为离线消息组装时的用户资料访问扩展点。",
    ("MessagingService", "MessageServiceImpl"): "消息服务实现，保存消息、构造推送体、校验会话成员并驱动实时/离线投递。",
    ("OfflineDataStoreService", "MessageServiceImpl"): "离线消息服务实现，负责 Kafka 消息落库、按用户会话聚合离线消息和查询消息明细。",
    ("ContactService", "SessionServiceImpl"): "联系人服务中的会话服务实现，维护私聊/群聊 session 与用户会话关系。",
    ("MessagingService", "SessionServiceImpl"): "消息服务中的会话查询实现，为发消息和红包链路校验会话存在性与会话类型。",
    ("OfflineDataStoreService", "SessionServiceImpl"): "离线存储服务中的会话查询实现，为离线消息按会话聚合提供会话元数据。",
    ("ContactService", "FriendServiceImpl"): "好友服务实现，处理搜索、好友详情、删除好友、拉黑好友等核心好友关系逻辑。",
    ("MessagingService", "FriendServiceImpl"): "消息服务中的好友关系查询实现，为私聊消息校验双方关系和状态。",
    ("MomentService", "FriendServiceImpl"): "朋友圈服务中的好友关系查询实现，用于判断动态可见范围和通知目标。",
    ("MessagingService", "UserSessionServiceImpl"): "消息服务中的用户会话关系查询实现，为群聊成员校验和会话权限判断提供数据。",
    ("OfflineDataStoreService", "UserSessionServiceImpl"): "离线存储服务中的用户会话关系查询实现，用于定位用户参与的会话并拉取离线消息。",
    ("ContactService", "UserSessionServiceImpl"): "联系人服务中的用户会话关系维护实现，用于创建、邀请、退出、踢人等群聊成员关系变更。",
    ("MessagingService", "RedPacketServiceImpl"): "红包发送服务实现，处理红包创建、余额扣减、消息体构造和事务一致性。",
    ("OfflineDataStoreService", "RedPacketServiceImpl"): "离线存储服务中的红包查询扩展点，用于离线红包消息展示时补充红包元数据。",
}


def rel(p: Path) -> str:
    return p.relative_to(ROOT).as_posix()


def should_include(p: Path) -> bool:
    if not p.is_file():
        return False
    r = rel(p)
    if r.startswith("docs/project-structure/"):
        return False
    if p.name in EXCLUDED_NAMES:
        return False
    parts = set(p.relative_to(ROOT).parts)
    if any(part in EXCLUDED_PARTS for part in parts):
        return False
    return True


def included_files() -> list[Path]:
    return sorted(p for p in ROOT.rglob("*") if should_include(p))


def detect_module(path: str) -> str:
    first = path.split("/", 1)[0]
    return first if first in MODULE_ORDER else "root-and-build"


def strip_java_noise(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    text = re.sub(r'""".*?"""', '""', text, flags=re.S)
    text = re.sub(r'"(?:\\.|[^"\\])*"', '""', text)
    text = re.sub(r"//.*", "", text)
    return text


def read_text(p: Path, limit: int | None = None) -> str:
    try:
        data = p.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""
    return data if limit is None else data[:limit]


def parse_java(p: Path) -> dict:
    text = read_text(p)
    code = strip_java_noise(text)
    pkg = re.search(r"^package\s+([\w.]+);", text, re.M)
    kind = re.search(r"public\s+(?:abstract\s+)?(class|interface|enum|record)\s+(\w+)", code)
    if not kind:
        kind = re.search(r"\b(class|interface|enum|record)\s+(\w+)", code)
    anns = []
    for a in re.findall(r"^\s*@(\w+)(?:\([^\n]*\))?", code, re.M):
        if a not in anns:
            anns.append(a)
    fields = []
    for m in re.finditer(r"(?m)^\s*(?:private|public|protected)\s+(?:static\s+)?(?:final\s+)?([\w<>?,\s\[\].]+)\s+(\w+)\s*(?:=|;)", code):
        typ = " ".join(m.group(1).split())
        name = m.group(2)
        if (name, typ) not in fields:
            fields.append((name, typ))
    methods = []
    for m in re.finditer(r"(?m)^\s*(?:public|protected|private)\s+(?:static\s+)?(?:final\s+)?[\w<>?,\s\[\].]+\s+(\w+)\s*\([^;{}]*\)\s*(?:throws [^{]+)?\{", code):
        name = m.group(1)
        if name not in METHOD_IGNORE and name not in methods:
            methods.append(name)
    for m in re.finditer(r"(?m)^\s*(?:[\w<>?,\s\[\].]+)\s+(\w+)\s*\([^{}]*\)\s*;", code):
        name = m.group(1)
        if name not in METHOD_IGNORE and name not in methods:
            methods.append(name)
    enum_values = []
    if kind and kind.group(1) == "enum":
        start = code.find("{")
        end_candidates = [idx for idx in [code.find(";", start), code.find("}", start)] if idx != -1]
        end = min(end_candidates) if end_candidates else -1
        body = code[start + 1:end] if start != -1 and end != -1 else ""
        enum_values = [x.strip() for x in re.split(r",", body) if x.strip() and re.match(r"^[A-Z0-9_]+(?:\([^)]*\))?$", x.strip())]
    imports = re.findall(r"^import\s+([\w.*]+);", text, re.M)
    return {
        "package": pkg.group(1) if pkg else "",
        "kind": kind.group(1) if kind else "文件",
        "name": kind.group(2) if kind else p.stem,
        "annotations": anns,
        "fields": fields,
        "methods": methods,
        "enum_values": enum_values,
        "imports": imports,
        "lines": text.count("\n") + (1 if text else 0),
    }


def layer_for(p: Path) -> str:
    r = rel(p)
    parts = p.relative_to(ROOT).parts
    if len(parts) == 1 or r.endswith("/pom.xml") or r.endswith("/.gitignore") or r.endswith(".iml") or r.startswith("scripts/"):
        return "module-build"
    if "/src/test/" in r:
        return "tests"
    if "/src/main/resources/" in r:
        if r.endswith("application.yml") or r.endswith("application-local.yml") or r.endswith("application-local.example.yml"):
            return "resources-config"
        if "/mapper/" in r and r.endswith(".xml"):
            return "resources-mapper"
        if "/sql/" in r:
            return "resources-sql"
        if "/static/" in r:
            return "resources-static"
        return "resources-config"
    if not r.endswith(".java"):
        return "other"
    normalized = r.replace("\\", "/").lower()
    basename = Path(r).name
    if basename.endswith("Application.java"):
        return "application"
    if "/controller/" in normalized or "/demos/web/" in normalized:
        return "controller"
    if "/service/impl/" in normalized:
        return "service-impl"
    if "/service/" in normalized:
        return "service"
    if "/mapper/" in normalized:
        return "mapper"
    if "/model/" in normalized:
        return "model"
    if "/data/" in normalized or "/dto/" in normalized:
        return "data-dto"
    if "/constants/" in normalized:
        return "constants"
    if "/config/" in normalized or "/conf/" in normalized:
        return "config"
    if "/exception/" in normalized or "/excption/" in normalized:
        return "exception"
    if "/utils/" in normalized or "/util/" in normalized:
        return "utils"
    if "/websocket/" in normalized:
        return "websocket"
    if "/route/" in normalized or "/feign/" in normalized or "/consumer/" in normalized:
        return "route-feign-consumer"
    if "/common/" in normalized:
        return "common"
    return "other"


def module_intro_line(module: str) -> str:
    kw = MODULE_KEYWORDS.get(module, [])
    return "、".join(kw) if kw else "构建、环境与项目文档"


def java_hint(info: dict, r: str, module: str, layer: str) -> str:
    name = info["name"]
    if (module, name) in QUALIFIED_BUSINESS_HINTS:
        return QUALIFIED_BUSINESS_HINTS[(module, name)]
    if name in BUSINESS_HINTS:
        return BUSINESS_HINTS[name]
    kind = info.get("kind", "文件")
    fields = [n for n, _ in info.get("fields", [])]
    methods = info.get("methods", [])
    if kind == "enum":
        vals = "、".join(v.split("(", 1)[0] for v in info.get("enum_values", [])[:10])
        return f"枚举类型，约束 {MODULE_TITLES.get(module, module)} 中的固定状态或类型" + (f"：{vals}。" if vals else "。")
    if kind == "interface":
        return f"接口抽象，定义 {LAYER_TITLES.get(layer, layer)} 的能力边界，主要方法为 {', '.join(methods[:8]) or '无显式方法'}。"
    if r.endswith("Request.java"):
        return "请求 DTO，承载前端或内部服务调用进入该接口时的入参。"
    if r.endswith("Response.java") or r.endswith("Result.java"):
        return "响应/结果 DTO，承载接口或服务处理后的结构化返回数据。"
    if r.endswith("Controller.java"):
        return "HTTP Controller，暴露 REST 接口并把请求转交对应业务服务。"
    if r.endswith("ServiceImpl.java"):
        return f"服务实现类，属于 {MODULE_TITLES.get(module, module)} 的 {LAYER_TITLES.get(layer, layer)}，核心方法包括 {', '.join(methods[:8]) or '无显式方法'}。"
    if r.endswith("Service.java"):
        return f"服务接口，定义 {MODULE_TITLES.get(module, module)} 的业务能力契约。"
    if r.endswith("Mapper.java"):
        return "MyBatis/MyBatis-Plus Mapper 接口，负责实体表的基础 CRUD 或自定义 SQL 映射。"
    if "/model/" in r:
        return f"数据库实体或业务模型，核心字段包括 {', '.join(fields[:10]) or '无显式字段'}。"
    if "/data/" in r or "/dto/" in r:
        return f"接口传输对象，核心字段包括 {', '.join(fields[:10]) or '无显式字段'}。"
    if "/constants/" in r:
        return "常量/枚举文件，集中维护状态码、业务状态、配置 key 或固定文本，避免魔法值散落。"
    if "/exception/" in r.lower() or "/excption/" in r.lower():
        return "异常类或统一异常处理器，用于把业务、校验、数据库或服务异常转换为稳定响应。"
    if "/config/" in r.lower() or "/conf/" in r.lower():
        return "配置类，负责创建 Bean、注册拦截器、配置 MyBatis/Redis/JSON/OSS 或框架扩展点。"
    if fields:
        return f"{LAYER_TITLES.get(layer, layer)}中的数据/组件类，核心字段包括 {', '.join(fields[:10])}。"
    return f"{MODULE_TITLES.get(module, module)} 中的 {kind} 文件。"


def parse_pom_summary(text: str) -> tuple[str, list[str]]:
    artifact = re.search(r"<artifactId>([^<]+)</artifactId>", text)
    packaging = re.search(r"<packaging>([^<]+)</packaging>", text)
    modules = re.findall(r"<module>([^<]+)</module>", text)
    deps = re.findall(r"<dependency>.*?<artifactId>([^<]+)</artifactId>.*?</dependency>", text, flags=re.S)
    plugins = re.findall(r"<plugin>.*?<artifactId>([^<]+)</artifactId>.*?</plugin>", text, flags=re.S)
    summary = f"Maven 构建文件，artifactId 为 `{artifact.group(1) if artifact else '未知'}`。"
    points = []
    if packaging:
        points.append(f"打包类型：`{packaging.group(1)}`。")
    if modules:
        points.append("聚合模块：" + "、".join(f"`{m}`" for m in modules) + "。")
    if deps:
        points.append("主要依赖：" + "、".join(f"`{d}`" for d in deps[:18]) + ("、……" if len(deps) > 18 else "") + "。")
    if plugins:
        points.append("构建插件：" + "、".join(f"`{p}`" for p in plugins[:8]) + "。")
    return summary, points


def parse_yml_summary(text: str) -> list[str]:
    points = []
    app = re.search(r"(?m)^\s*name:\s*([^\n]+)", text)
    port = re.search(r"(?m)^\s*port:\s*([^\n]+)", text)
    if app:
        points.append(f"服务名：`{app.group(1).strip()}`。")
    if port:
        points.append(f"端口配置：`{port.group(1).strip()}`。")
    if "nacos" in text:
        points.append("接入 Nacos 服务发现。")
    if "redis" in text:
        points.append("接入 Redis，用于缓存、路由、验证码、锁或在线状态。")
    if "kafka" in text:
        points.append("接入 Kafka，用于消息异步投递或离线消费。")
    if "datasource" in text:
        points.append("配置 MySQL 数据源和 Hikari 连接池。")
    if "gateway" in text and "routes" in text:
        routes = re.findall(r"(?m)^\s*-\s*id:\s*([^\n]+)", text)
        if routes:
            points.append("网关路由：" + "、".join(f"`{x.strip()}`" for x in routes[:12]) + "。")
    return points


def parse_xml_summary(text: str) -> list[str]:
    namespace = re.search(r"<mapper\s+namespace=\"([^\"]+)\"", text)
    statements = re.findall(r"<(select|insert|update|delete)\b[^>]*\bid=\"([^\"]+)\"", text)
    points = []
    if namespace:
        points.append(f"Mapper namespace：`{namespace.group(1)}`。")
    if statements:
        stmt = "、".join(f"`{kind}:{sid}`" for kind, sid in statements[:20])
        points.append("SQL 语句：" + stmt + ("、……" if len(statements) > 20 else "") + "。")
    return points


def summarize_non_java(p: Path, module: str, layer: str) -> tuple[str, list[str]]:
    r = rel(p)
    text = read_text(p, 20000)
    if p.name == "pom.xml":
        return parse_pom_summary(text)
    if p.name == ".env.example":
        keys = re.findall(r"(?m)^([A-Z][A-Z0-9_]+)=", text)
        return "环境变量示例文件，只放本地启动所需的非真实密钥占位。", ["覆盖变量：" + "、".join(f"`{k}`" for k in keys[:30]) + ("、……" if len(keys) > 30 else "") + "。"]
    if p.name == ".gitignore":
        return "Git 忽略规则文件，避免提交构建产物、本地配置和敏感文件。", []
    if p.suffix == ".iml":
        return "IDEA 模块元数据文件，用于本地 IDE 识别工程结构。", []
    if p.suffix in {".yml", ".yaml"}:
        return "Spring Boot YAML 配置文件，定义服务名、端口、数据源、缓存、注册中心、消息队列或业务参数。", parse_yml_summary(text)
    if p.suffix == ".xml":
        return "MyBatis XML 映射文件，承载复杂 SQL、结果映射或自定义查询。", parse_xml_summary(text)
    if p.suffix == ".sql":
        statements = re.findall(r"(?mi)^\s*(CREATE|ALTER|INSERT|UPDATE|DELETE|SELECT)\b", text)
        return "SQL 脚本文件，用于补充表结构、出站表、红包一致性或数据修复相关 SQL。", [f"包含 SQL 语句类型：{', '.join(sorted(set(statements))) or '未识别'}。"]
    if p.suffix == ".html":
        ids = re.findall(r'id="([^"]+)"', text)
        title = re.search(r"<title>(.*?)</title>", text, re.S | re.I)
        return "静态 HTML 页面，通常作为服务默认欢迎页或简单调试页。", [f"页面标题：`{title.group(1).strip()}`。" if title else "未声明 title。", f"DOM id：{', '.join(ids[:12]) or '无'}。"]
    if p.suffix == ".py":
        funcs = re.findall(r"^def\s+(\w+)\s*\(", text, re.M)
        return "Python 辅助脚本，用于生成或维护项目文档。", ["函数：" + "、".join(f"`{f}()`" for f in funcs[:18]) + ("、……" if len(funcs) > 18 else "") + "。"]
    return "项目辅助文件。", []


def file_section(p: Path) -> str:
    r = rel(p)
    module = detect_module(r)
    layer = layer_for(p)
    lines = [f"### `{r}`", ""]
    if p.suffix == ".java":
        info = parse_java(p)
        lines.append(f"**总体说明：** {java_hint(info, r, module, layer)}")
        lines.append("")
        lines.append("**分层展开：**")
        lines.append(f"- 类型：`{info['kind']}` `{info['name']}`；包：`{info.get('package') or '默认包'}`；约 `{info['lines']}` 行。")
        lines.append(f"- 所属模块：{MODULE_TITLES.get(module, module)}；所属层：{LAYER_TITLES.get(layer, layer)}。")
        if info["annotations"]:
            lines.append("- 主要注解：" + "、".join(f"`@{a}`" for a in info["annotations"][:14]) + "。")
        if info["fields"]:
            field_text = "；".join(f"`{name}: {typ}`" for name, typ in info["fields"][:20])
            lines.append(f"- 关键字段：{field_text}{'；……' if len(info['fields']) > 20 else ''}。")
        if info["methods"]:
            method_text = "、".join(f"`{m}()`" for m in info["methods"][:24])
            lines.append(f"- 关键方法：{method_text}{'、……' if len(info['methods']) > 24 else ''}。")
        if info["enum_values"]:
            vals = "、".join(f"`{v}`" for v in info["enum_values"][:20])
            lines.append(f"- 枚举值：{vals}{'、……' if len(info['enum_values']) > 20 else ''}。")
        imports = info.get("imports", [])
        dep_hints = []
        if any("BaseMapper" in x or "Mybatis" in x or "MyBatis" in x for x in imports):
            dep_hints.append("依赖 MyBatis/MyBatis-Plus 数据访问")
        if any("Redis" in x or "Redisson" in x for x in imports):
            dep_hints.append("依赖 Redis/Redisson")
        if any("Kafka" in x for x in imports):
            dep_hints.append("依赖 Kafka 消息队列")
        if any("OkHttp" in x or "RestTemplate" in x or "WebClient" in x for x in imports):
            dep_hints.append("会发起跨服务 HTTP 调用")
        if any("Nacos" in x or "DiscoveryClient" in x or "ServiceInstance" in x for x in imports):
            dep_hints.append("依赖 Nacos/服务发现")
        if any("Netty" in x or "io.netty" in x or "Channel" in x for x in imports):
            dep_hints.append("依赖 Netty 长连接能力")
        if any("Jwt" in x or "Claims" in x for x in imports):
            dep_hints.append("涉及 JWT 生成或校验")
        if any("COS" in x or "qcloud" in x.lower() for x in imports):
            dep_hints.append("涉及腾讯云 COS")
        if dep_hints:
            lines.append("- 依赖提示：" + "；".join(dep_hints) + "。")
    else:
        summary, points = summarize_non_java(p, module, layer)
        lines.append(f"**总体说明：** {summary}")
        lines.append("")
        lines.append("**分层展开：**")
        lines.append(f"- 文件类型：`{p.suffix or p.name}`；大小约 {p.stat().st_size} 字节。")
        lines.append(f"- 所属模块：{MODULE_TITLES.get(module, module)}；所属层：{LAYER_TITLES.get(layer, layer)}。")
        for pt in points:
            lines.append(f"- {pt}")
    lines.append("")
    return "\n".join(lines)


def build_tree(paths: Iterable[str]) -> str:
    tree = {}
    for path in paths:
        node = tree
        for part in path.split("/"):
            node = node.setdefault(part, {})
    def render(node: dict, prefix: str = "") -> list[str]:
        out = []
        items = sorted(node.items(), key=lambda kv: (0 if kv[1] else 1, kv[0].lower()))
        for i, (name, child) in enumerate(items):
            last = i == len(items) - 1
            out.append(prefix + ("└── " if last else "├── ") + name)
            if child:
                out.extend(render(child, prefix + ("    " if last else "│   ")))
        return out
    return "\n".join(render(tree))


def group_by_layer(files: list[Path]) -> dict[str, list[Path]]:
    grouped = defaultdict(list)
    for p in files:
        grouped[layer_for(p)].append(p)
    return {k: sorted(v, key=rel) for k, v in sorted(grouped.items(), key=lambda kv: LAYER_ORDER.index(kv[0]) if kv[0] in LAYER_ORDER else 999)}


def layer_intro(module: str, layer: str) -> str:
    title = LAYER_TITLES.get(layer, layer)
    if layer == "controller":
        return f"本层是 {MODULE_TITLES.get(module, module)} 的外部 HTTP 入口，负责参数接收、校验触发和服务调用转发。"
    if layer == "service-impl":
        return f"本层承载 {MODULE_TITLES.get(module, module)} 的核心业务流程，通常会组合 Mapper、Redis、Kafka 或其他服务。"
    if layer == "data-dto":
        return "本层主要是请求/响应/通知传输对象，用于明确接口入参、出参和跨服务消息结构。"
    if layer == "resources-mapper":
        return "本层是 MyBatis XML SQL 映射，补充 Java Mapper 无法表达或不适合注解表达的复杂查询。"
    if layer == "resources-config":
        return "本层是运行配置，决定服务名、端口、数据库、Redis、Nacos、Kafka 和业务参数。"
    return f"本层覆盖 {title} 相关文件，下面按文件逐一说明职责、结构和依赖。"


def write_module_doc(module: str, files: list[Path]) -> None:
    title = MODULE_TITLES[module]
    md = []
    md.append(f"# {title}")
    md.append("")
    md.append(f"**总体说明：** {MODULE_INTROS[module]}")
    md.append("")
    md.append("## 逻辑定位")
    md.append("")
    md.append(f"- 模块关键词：{module_intro_line(module)}。")
    md.append(f"- 纳入文件数：{len(files)}。")
    if module != "root-and-build":
        md.append("- 典型分层：启动类 → Controller → Service 接口/实现 → Mapper/Model → DTO/Data → 常量/异常/配置 → resources → tests。")
    else:
        md.append("- 典型分层：聚合 POM → 环境变量示例 → IDE/Git 元数据 → 文档生成脚本。")
    md.append("")
    md.append("## 递归树结构")
    md.append("")
    md.append("```text")
    md.append(build_tree(rel(p) for p in files))
    md.append("```")
    md.append("")
    md.append("## 逐文件详细说明")
    md.append("")
    grouped = group_by_layer(files)
    for layer, ps in grouped.items():
        md.append(f"## {LAYER_TITLES.get(layer, layer)}")
        md.append("")
        md.append(f"**总体说明：** {layer_intro(module, layer)}")
        md.append("")
        for p in ps:
            md.append(file_section(p))
    fname = "00-root-and-build.md" if module == "root-and-build" else f"{MODULE_ORDER.index(module):02d}-{module}.md"
    (OUT / fname).write_text("\n".join(md).rstrip() + "\n", encoding="utf-8")


def write_index(files_by_module: dict[str, list[Path]], all_files: list[Path]) -> None:
    java_main = sum(1 for p in all_files if "/src/main/java/" in rel(p) and p.suffix == ".java")
    java_test = sum(1 for p in all_files if "/src/test/java/" in rel(p) and p.suffix == ".java")
    resources = sum(1 for p in all_files if "/src/main/resources/" in rel(p))
    xmls = sum(1 for p in all_files if p.suffix == ".xml")
    sqls = sum(1 for p in all_files if p.suffix == ".sql")
    md = []
    md.append("# Chat 项目逻辑树与逐文件说明")
    md.append("")
    md.append("**总体说明：** 本文档从当前 `./chat` 工作树生成，按 Maven 聚合根工程和 7 个微服务模块组织，递归展示树结构，并对每个纳入范围的文件做“先总后分”的逐文件说明。它用于快速理解 InfiniteChat 的认证、网关、实时通信、消息、离线存储、联系人和朋友圈模块。")
    md.append("")
    md.append("## 覆盖范围")
    md.append("")
    md.append("- 纳入：根目录工程文件、各微服务 `pom.xml`、`src/main/java`、`src/main/resources`、`src/test/java`、`scripts`。")
    md.append("- 排除：`target/` 构建产物、`.git/`、`.idea/`、`.mvn/`、`.DS_Store`、本目录生成文档。")
    md.append(f"- 当前纳入文件总数：{len(all_files)}；主源码 Java：{java_main}；测试 Java：{java_test}；资源文件：{resources}；XML：{xmls}；SQL：{sqls}。")
    md.append("")
    md.append("## 微服务总览")
    md.append("")
    md.append("```text")
    md.append("InfiniteChat")
    md.append("├── GateWay: 统一入口，路由 /api/v1/user、/message、/chat、/offline、/moment、/contact 与 WebSocket")
    md.append("├── AuthenticationService: 注册、登录、验证码、JWT、头像和上传授权")
    md.append("├── ContactService: 好友申请、好友关系、群聊、会话和成员管理")
    md.append("├── MessagingService: 发送消息、红包、余额、出站表和 Kafka 投递")
    md.append("├── OfflineDataStoreService: Kafka 消费、离线消息落库和离线消息拉取")
    md.append("├── RealTimeCommunicationService: Netty WebSocket、在线推送、ACK、心跳和用户路由")
    md.append("└── MomentService: 朋友圈动态、点赞、评论、列表和通知推送")
    md.append("```")
    md.append("")
    md.append("## 分类文档索引")
    md.append("")
    for module in MODULE_ORDER:
        files = files_by_module.get(module, [])
        if not files:
            continue
        fname = "00-root-and-build.md" if module == "root-and-build" else f"{MODULE_ORDER.index(module):02d}-{module}.md"
        md.append(f"- [{MODULE_TITLES[module]}](./{fname})：{len(files)} 个文件。")
    md.append("")
    md.append("## 推荐阅读路径")
    md.append("")
    md.append("1. 先读 `00-root-and-build.md`，确认聚合模块、环境变量和文档生成方式。")
    md.append("2. 再读 `02-GateWay.md`，理解外部请求如何路由到各服务。")
    md.append("3. 按业务入口读 `01-AuthenticationService.md`、`06-ContactService.md`、`04-MessagingService.md`。")
    md.append("4. 按消息投递链路读 `03-RealTimeCommunicationService.md` 和 `05-OfflineDataStoreService.md`。")
    md.append("5. 最后读 `07-MomentService.md`，理解朋友圈如何复用好友关系并推送通知。")
    md.append("")
    md.append("## 关键业务链路")
    md.append("")
    md.append("### 登录认证链路")
    md.append("")
    md.append("```text")
    md.append("GateWay /api/v1/user/**")
    md.append("└── AuthenticationService")
    md.append("    ├── UserController / CommonController")
    md.append("    ├── JwtHandler / SourceHandler 拦截")
    md.append("    ├── UserServiceImpl 注册、登录、验证码登录、头像更新")
    md.append("    ├── CommonServiceImpl 验证码、邮件和上传 URL")
    md.append("    └── UserMapper / UserBalanceMapper 写用户与余额")
    md.append("```")
    md.append("")
    md.append("### 消息发送与投递链路")
    md.append("")
    md.append("```text")
    md.append("GateWay /api/v1/chat/**")
    md.append("└── MessagingService")
    md.append("    ├── SendMsgController 接收发消息请求")
    md.append("    ├── MessageServiceImpl 保存消息并构造推送体")
    md.append("    ├── RealtimeRouteService 判断在线路由")
    md.append("    ├── Netty/HTTP 推送到 RealTimeCommunicationService")
    md.append("    └── KafkaOutboxServiceImpl 通过出站表保证异步投递")
    md.append("        └── OfflineDataStoreService.MessageConsumer 消费并保存离线消息")
    md.append("```")
    md.append("")
    md.append("### 实时 WebSocket 链路")
    md.append("")
    md.append("```text")
    md.append("GateWay /api/v1/netty")
    md.append("└── lb:ws://NettyService")
    md.append("    └── RealTimeCommunicationService.NettyServer")
    md.append("        ├── WebSocketTokenAuthenHeader 校验 token")
    md.append("        ├── MessageInboundHandler 处理 ACK/心跳/登出")
    md.append("        ├── ChannelManager 维护 userId 与 Channel")
    md.append("        └── AckMessageManager 管理待确认消息和重试")
    md.append("```")
    md.append("")
    md.append("### 好友与群聊链路")
    md.append("")
    md.append("```text")
    md.append("GateWay /api/v1/contact/**")
    md.append("└── ContactService.ContactController")
    md.append("    ├── FriendServiceImpl 搜索、详情、删除、拉黑")
    md.append("    ├── ApplyFriendServiceImpl 好友申请、未读数、处理申请")
    md.append("    ├── GroupServiceImpl 创建/邀请群聊")
    md.append("    ├── SessionServiceImpl 维护会话")
    md.append("    └── PushServiceImpl 通知 RealTimeCommunicationService")
    md.append("```")
    md.append("")
    md.append("### 朋友圈链路")
    md.append("")
    md.append("```text")
    md.append("GateWay /api/v1/moment/**")
    md.append("└── MomentService.MomentController")
    md.append("    ├── MomentServiceImpl 发布、删除和列表查询")
    md.append("    ├── MomentLikeServiceImpl 点赞/取消点赞")
    md.append("    ├── MomentCommentServiceImpl 评论/删除评论")
    md.append("    └── MomentNotificationServiceImpl 推送动态通知")
    md.append("```")
    md.append("")
    md.append("## 文件覆盖索引")
    md.append("")
    md.append("下面列出每个文件所在的分类文档，方便反查。")
    md.append("")
    for module in MODULE_ORDER:
        files = files_by_module.get(module, [])
        if not files:
            continue
        fname = "00-root-and-build.md" if module == "root-and-build" else f"{MODULE_ORDER.index(module):02d}-{module}.md"
        md.append(f"### {MODULE_TITLES[module]}")
        md.append("")
        for p in files:
            md.append(f"- `{rel(p)}` → [`{fname}`](./{fname})")
        md.append("")
    (OUT / "README.md").write_text("\n".join(md).rstrip() + "\n", encoding="utf-8")


def write_manifest(files_by_module: dict[str, list[Path]], all_files: list[Path]) -> None:
    manifest = {
        "generatedForRoot": str(ROOT),
        "fileCount": len(all_files),
        "modules": {module: [rel(p) for p in files_by_module.get(module, [])] for module in MODULE_ORDER},
    }
    (OUT / "coverage-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    all_files = included_files()
    files_by_module = {module: [] for module in MODULE_ORDER}
    for p in all_files:
        files_by_module.setdefault(detect_module(rel(p)), []).append(p)
    for module in files_by_module:
        files_by_module[module].sort(key=rel)
    write_index(files_by_module, all_files)
    for module in MODULE_ORDER:
        files = files_by_module.get(module, [])
        if files:
            write_module_doc(module, files)
    write_manifest(files_by_module, all_files)
    print(f"Generated {len(all_files)} file entries into {OUT}")


if __name__ == "__main__":
    main()
