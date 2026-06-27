package com.lou.infinitechatagent.exception;

import com.lou.infinitechatagent.common.BaseResponse;
import com.lou.infinitechatagent.common.ErrorCode;
import dev.langchain4j.guardrail.InputGuardrailException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.Map;

/**
 * 全局异常处理器。契约 §3:**停止"全 200 + 体内 code"** —— 错误映射真实 HTTP 状态(401/403/404/422/429/5xx),
 * body 仍为统一包络 {@link BaseResponse}{code,message,data,traceId,timestamp}。
 */
@RestControllerAdvice
@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<BaseResponse<?>> businessException(BusinessException e) {
        log.warn("BusinessException code={} msg={}", e.getCode(), e.getMessage());
        return respond(e.getCode(), e.getMessage(), null);
    }

    @ExceptionHandler(MissingAiModelConfigurationException.class)
    public ResponseEntity<BaseResponse<?>> missingAiModelConfiguration(MissingAiModelConfigurationException e) {
        log.error("Missing AI model configuration: {}", e.getMessage());
        return respond(ErrorCode.DEPENDENCY_UNAVAILABLE.getCode(), e.getMessage(), null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<BaseResponse<?>> validation(MethodArgumentNotValidException ex) {
        // 契约 §3:VALIDATION_FAILED(422),data.fieldErrors=[{field,message}]
        List<Map<String, String>> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> Map.of(
                        "field", fe.getField(),
                        "message", fe.getDefaultMessage() == null ? "" : fe.getDefaultMessage()))
                .toList();
        return respond(ErrorCode.INVALID_PARAMETER_ERROR.getCode(), "参数校验失败",
                Map.of("fieldErrors", fieldErrors));
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<BaseResponse<?>> missingParam(MissingServletRequestParameterException e) {
        log.warn("缺少必填参数: {}", e.getParameterName());
        return respond(ErrorCode.PARAMS_ERROR.getCode(), "缺少必填参数: " + e.getParameterName(), null);
    }

    @ExceptionHandler(InputGuardrailException.class)
    public ResponseEntity<BaseResponse<?>> inputGuardrail(InputGuardrailException e) {
        log.warn("输入护轨拦截: {}", e.getMessage());
        return respond(ErrorCode.SENSITIVE_WORD_ERROR.getCode(), ErrorCode.SENSITIVE_WORD_ERROR.getMessage(), null);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<BaseResponse<?>> runtime(RuntimeException e) {
        log.error("RuntimeException", e);
        return respond(ErrorCode.SYSTEM_ERROR.getCode(), "系统错误", null);
    }

    private static ResponseEntity<BaseResponse<?>> respond(int code, String message, Object data) {
        BaseResponse<Object> body = new BaseResponse<>(code, data, message);
        return ResponseEntity.status(ErrorCode.httpStatusForCode(code)).body(body);
    }
}
