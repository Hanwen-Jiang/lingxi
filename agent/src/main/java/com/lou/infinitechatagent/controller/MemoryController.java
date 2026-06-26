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
import jakarta.annotation.Resource;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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
    public BaseResponse<SessionSummary> getSessionSummary(@RequestParam Long userId, @RequestParam Long sessionId) {
        return ResultUtils.success(sessionSummaryService.findSummary(userId, sessionId)
                .orElse(SessionSummary.builder()
                        .userId(userId)
                        .sessionId(sessionId)
                        .summary("")
                        .turnCount(0)
                        .build()));
    }

    @PostMapping("/session/summarize")
    public BaseResponse<SessionSummary> summarize(@RequestBody SessionSummaryRequest request) {
        return ResultUtils.success(sessionSummaryService.refreshNow(request.getUserId(), request.getSessionId()));
    }

    @GetMapping("/context")
    public BaseResponse<MemoryContext> getMemoryContext(@RequestParam Long userId,
                                                        @RequestParam Long sessionId,
                                                        @RequestParam(required = false) String prompt) {
        return ResultUtils.success(memoryContextBuilder.build(userId, sessionId, prompt));
    }

    @PostMapping("/context")
    public BaseResponse<MemoryContext> buildMemoryContext(@RequestBody MemoryContextRequest request) {
        return ResultUtils.success(memoryContextBuilder.build(request.getUserId(), request.getSessionId(), request.getPrompt()));
    }

    @PostMapping("/write")
    public BaseResponse<MemoryItem> writeMemory(@RequestBody MemoryWriteRequest request) {
        return ResultUtils.success(longTermMemoryService.write(request));
    }

    @PostMapping("/correct")
    public BaseResponse<MemoryCorrectionResult> correctMemory(@RequestBody MemoryCorrectionRequest request) {
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
    public BaseResponse<List<MemoryItem>> listUserMemories(@PathVariable Long userId,
                                                           @RequestParam(required = false) MemoryType memoryType,
                                                           @RequestParam(defaultValue = "10") int limit) {
        return ResultUtils.success(longTermMemoryService.findActiveByUser(userId, memoryType, limit));
    }

    // 过渡限权(P0 止损,B1/G10):/item 与 /disable 必须声明归属 userId,且与记忆所有者一致,
    // 否则按"不存在"处理(不泄露存在性)。封堵"仅凭猜测 memoryId 即可越权读取/停用他人记忆"。
    // P1 网关身份闭环后,userId 改由可信 X-User-Id 派生,此参数移除。
    @GetMapping("/item/{memoryId}")
    public BaseResponse<MemoryItem> getMemory(@PathVariable String memoryId,
                                              @RequestParam Long userId) {
        return ResultUtils.success(requireOwnedMemory(memoryId, userId));
    }

    @PostMapping("/disable/{memoryId}")
    public BaseResponse<Boolean> disableMemory(@PathVariable String memoryId,
                                               @RequestParam Long userId) {
        requireOwnedMemory(memoryId, userId);
        return ResultUtils.success(longTermMemoryService.disable(memoryId));
    }

    private MemoryItem requireOwnedMemory(String memoryId, Long userId) {
        return longTermMemoryService.findByMemoryId(memoryId)
                .filter(memory -> userId != null && userId.equals(memory.getUserId()))
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND_ERROR, "记忆不存在：" + memoryId));
    }

    @PostMapping("/reflection")
    public BaseResponse<ReflectionResult> writeReflection(@RequestBody ReflectionRequest request) {
        return ResultUtils.success(reflectiveMemoryService.reflect(request));
    }

    @PostMapping("/agent/context")
    public BaseResponse<MemoryTrace> buildAgentMemoryContext(@RequestBody MemoryAgentRequest request) {
        return ResultUtils.success(memoryAgent.readContext(request.getUserId(), request.getSessionId(), request.getPrompt()));
    }
}
