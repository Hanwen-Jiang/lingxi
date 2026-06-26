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
 * 记忆 API。expand/contract(B1/D3):userId 一律经 {@link AuthPrincipal#resolveUserId}
 * 解析——网关注入身份在场则<b>以网关身份为准</b>(忽略 body/param 的 userId,IDOR 闭环),
 * 否则回退请求体/参数里的 userId(网关上线前的过渡)。enforce 翻 true 且 S2 改走网关后,
 * 移除 body/param userId 字段(contract 相)。
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
                                                          @RequestParam(required = false) Long userId,
                                                          @RequestParam Long sessionId) {
        Long uid = principal.resolveUserId(userId);
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
        Long uid = principal.resolveUserId(request.getUserId());
        return ResultUtils.success(sessionSummaryService.refreshNow(uid, request.getSessionId()));
    }

    @GetMapping("/context")
    public BaseResponse<MemoryContext> getMemoryContext(@CurrentUser AuthPrincipal principal,
                                                        @RequestParam(required = false) Long userId,
                                                        @RequestParam Long sessionId,
                                                        @RequestParam(required = false) String prompt) {
        return ResultUtils.success(memoryContextBuilder.build(principal.resolveUserId(userId), sessionId, prompt));
    }

    @PostMapping("/context")
    public BaseResponse<MemoryContext> buildMemoryContext(@CurrentUser AuthPrincipal principal,
                                                          @RequestBody MemoryContextRequest request) {
        Long uid = principal.resolveUserId(request.getUserId());
        return ResultUtils.success(memoryContextBuilder.build(uid, request.getSessionId(), request.getPrompt()));
    }

    @PostMapping("/write")
    public BaseResponse<MemoryItem> writeMemory(@CurrentUser AuthPrincipal principal,
                                                @RequestBody MemoryWriteRequest request) {
        request.setUserId(principal.resolveUserId(request.getUserId()));
        return ResultUtils.success(longTermMemoryService.write(request));
    }

    @PostMapping("/correct")
    public BaseResponse<MemoryCorrectionResult> correctMemory(@CurrentUser AuthPrincipal principal,
                                                              @RequestBody MemoryCorrectionRequest request) {
        request.setUserId(principal.resolveUserId(request.getUserId()));
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
        return ResultUtils.success(longTermMemoryService.findActiveByUser(principal.resolveUserId(userId), memoryType, limit));
    }

    // /item 与 /disable:归属校验(B1/G10),非属主按"不存在"处理(不泄露存在性)。
    // userId 经 principal.resolveUserId 解析(网关身份优先);enforce 后移除 param。
    @GetMapping("/item/{memoryId}")
    public BaseResponse<MemoryItem> getMemory(@CurrentUser AuthPrincipal principal,
                                              @PathVariable String memoryId,
                                              @RequestParam(required = false) Long userId) {
        return ResultUtils.success(requireOwnedMemory(memoryId, principal.resolveUserId(userId)));
    }

    @PostMapping("/disable/{memoryId}")
    public BaseResponse<Boolean> disableMemory(@CurrentUser AuthPrincipal principal,
                                               @PathVariable String memoryId,
                                               @RequestParam(required = false) Long userId) {
        requireOwnedMemory(memoryId, principal.resolveUserId(userId));
        return ResultUtils.success(longTermMemoryService.disable(memoryId));
    }

    private MemoryItem requireOwnedMemory(String memoryId, Long userId) {
        return longTermMemoryService.findByMemoryId(memoryId)
                .filter(memory -> userId != null && userId.equals(memory.getUserId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ERROR, "记忆不存在：" + memoryId));
    }

    @PostMapping("/reflection")
    public BaseResponse<ReflectionResult> writeReflection(@RequestBody ReflectionRequest request) {
        // 反思写入主体随后续 sweep 接入 @CurrentUser(ReflectionRequest 的 userId 形状待核)。
        return ResultUtils.success(reflectiveMemoryService.reflect(request));
    }

    @PostMapping("/agent/context")
    public BaseResponse<MemoryTrace> buildAgentMemoryContext(@CurrentUser AuthPrincipal principal,
                                                             @RequestBody MemoryAgentRequest request) {
        Long uid = principal.resolveUserId(request.getUserId());
        return ResultUtils.success(memoryAgent.readContext(uid, request.getSessionId(), request.getPrompt()));
    }
}
