package com.lou.infinitechatagent.controller;

import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ErrorCode;
import com.lou.infinitechatagent.common.ResultUtils;
import com.lou.infinitechatagent.exception.BusinessException;
import com.lou.infinitechatagent.memory.LongTermMemoryService;
import com.lou.infinitechatagent.memory.MemoryAgent;
import com.lou.infinitechatagent.memory.MemoryContextBuilder;
import com.lou.infinitechatagent.memory.ReflectiveMemoryService;
import com.lou.infinitechatagent.memory.SessionSummaryService;
import com.lou.infinitechatagent.memory.dto.MemoryContext;
import com.lou.infinitechatagent.memory.dto.MemoryContextRequest;
import com.lou.infinitechatagent.memory.dto.MemoryAgentRequest;
import com.lou.infinitechatagent.memory.dto.MemoryCorrectionRequest;
import com.lou.infinitechatagent.memory.dto.MemoryCorrectionResult;
import com.lou.infinitechatagent.memory.dto.MemoryItem;
import com.lou.infinitechatagent.memory.dto.MemoryTrace;
import com.lou.infinitechatagent.memory.dto.MemoryType;
import com.lou.infinitechatagent.memory.dto.MemoryWriteRequest;
import com.lou.infinitechatagent.memory.dto.ReflectionRequest;
import com.lou.infinitechatagent.memory.dto.ReflectionResult;
import com.lou.infinitechatagent.memory.dto.SessionSummary;
import com.lou.infinitechatagent.memory.dto.SessionSummaryRequest;
import com.lou.infinitechatagent.security.AuthPrincipal;
import com.lou.infinitechatagent.security.CurrentUser;
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 记忆 API。<b>contract 相(P3,enforce-identity=true,B1/D3):</b> userId 一律取自网关注入身份
 * {@link AuthPrincipal#requireUserId()}——<b>不再接受/回退请求体或参数里的 userId</b>(客户端若仍传,被忽略)。
 * {@code /user/{userId}} 走 requireSelf:只能访问自己的资源(越权 403)。
 */
@RestController
@RequestMapping("/memory")
public class MemoryController {

    @Resource
    private SessionSummaryService sessionSummaryService;

    @Resource
    private LongTermMemoryService longTermMemoryService;

    @Resource
    private MemoryContextBuilder memoryContextBuilder;

    @Resource
    private ReflectiveMemoryService reflectiveMemoryService;

    @Resource
    private MemoryAgent memoryAgent;

    @GetMapping("/session/summary")
    public BaseResponse<SessionSummary> getSessionSummary(@CurrentUser AuthPrincipal principal,
                                                          @RequestParam Long sessionId) {
        Long uid = principal.requireUserId();
        return ResultUtils.success(sessionSummaryService.findSummary(uid, sessionId)
                .orElse(SessionSummary.builder()
                        .userId(uid)
                        .sessionId(sessionId)
                        .summary("")
                        .turnCount(0)
                        .build()));
    }

    @PostMapping("/session/summarize")
    public BaseResponse<SessionSummary> summarize(@CurrentUser AuthPrincipal principal,
                                                  @RequestBody SessionSummaryRequest request) {
        return ResultUtils.success(sessionSummaryService.refreshNow(principal.requireUserId(), request.getSessionId()));
    }

    @GetMapping("/context")
    public BaseResponse<MemoryContext> getMemoryContext(@CurrentUser AuthPrincipal principal,
                                                        @RequestParam Long sessionId,
                                                        @RequestParam(required = false) String prompt) {
        return ResultUtils.success(memoryContextBuilder.build(principal.requireUserId(), sessionId, prompt));
    }

    @PostMapping("/context")
    public BaseResponse<MemoryContext> buildMemoryContext(@CurrentUser AuthPrincipal principal,
                                                          @RequestBody MemoryContextRequest request) {
        return ResultUtils.success(memoryContextBuilder.build(principal.requireUserId(), request.getSessionId(), request.getPrompt()));
    }

    @PostMapping("/write")
    public BaseResponse<MemoryItem> writeMemory(@CurrentUser AuthPrincipal principal,
                                                @RequestBody MemoryWriteRequest request) {
        request.setUserId(principal.requireUserId());
        return ResultUtils.success(longTermMemoryService.write(request));
    }

    @PostMapping("/correct")
    public BaseResponse<MemoryCorrectionResult> correctMemory(@CurrentUser AuthPrincipal principal,
                                                              @RequestBody MemoryCorrectionRequest request) {
        request.setUserId(principal.requireUserId());
        MemoryType memoryType = request.getMemoryType() == null ? MemoryType.IMPORTANT_FACT : request.getMemoryType();
        List<String> disabledMemoryIds = longTermMemoryService.disableActiveByType(request.getUserId(), memoryType);
        MemoryItem correctedMemory = longTermMemoryService.correct(request);
        return ResultUtils.success(MemoryCorrectionResult.builder()
                .correctedMemory(correctedMemory)
                .disabledMemoryIds(disabledMemoryIds)
                .reason(request.getReason())
                .build());
    }

    @GetMapping("/user/{userId}")
    public BaseResponse<List<MemoryItem>> listUserMemories(@CurrentUser AuthPrincipal principal,
                                                           @PathVariable Long userId,
                                                           @RequestParam(required = false) MemoryType memoryType,
                                                           @RequestParam(defaultValue = "10") int limit) {
        // requireSelf:路径 userId 必须等于网关身份,否则 403(只能列自己的记忆)。
        return ResultUtils.success(longTermMemoryService.findActiveByUser(principal.requireSelf(userId), memoryType, limit));
    }

    // /item 与 /disable:归属校验(B1/G10),非属主按"不存在"处理(不泄露存在性)。userId 取自网关身份。
    @GetMapping("/item/{memoryId}")
    public BaseResponse<MemoryItem> getMemory(@CurrentUser AuthPrincipal principal,
                                              @PathVariable String memoryId) {
        return ResultUtils.success(requireOwnedMemory(memoryId, principal.requireUserId()));
    }

    @PostMapping("/disable/{memoryId}")
    public BaseResponse<Boolean> disableMemory(@CurrentUser AuthPrincipal principal,
                                               @PathVariable String memoryId) {
        requireOwnedMemory(memoryId, principal.requireUserId());
        return ResultUtils.success(longTermMemoryService.disable(memoryId));
    }

    private MemoryItem requireOwnedMemory(String memoryId, Long userId) {
        return longTermMemoryService.findByMemoryId(memoryId)
                .filter(memory -> userId != null && userId.equals(memory.getUserId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ERROR, "记忆不存在：" + memoryId));
    }

    @PostMapping("/reflection")
    public BaseResponse<ReflectionResult> writeReflection(@CurrentUser AuthPrincipal principal,
                                                          @RequestBody ReflectionRequest request) {
        request.setUserId(principal.requireUserId());
        return ResultUtils.success(reflectiveMemoryService.reflect(request));
    }

    @PostMapping("/agent/context")
    public BaseResponse<MemoryTrace> buildAgentMemoryContext(@CurrentUser AuthPrincipal principal,
                                                             @RequestBody MemoryAgentRequest request) {
        return ResultUtils.success(memoryAgent.readContext(principal.requireUserId(), request.getSessionId(), request.getPrompt()));
    }
}
