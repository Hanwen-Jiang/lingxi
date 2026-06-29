package com.lou.realtimecommunicationservice.web;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;
import com.lou.common.api.ErrorCode;
import com.lou.common.api.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

/**
 * @ClassName ApiExceptionHandler
 * @Description 统一异常 -> chat-common 包络 + 真实 HTTP 状态(03-contracts §2/§3)。
 *              RTC 的 /api/v1/message/** 为内部接口,MessagingService 经 OkHttp 按 2xx 判定成功,
 *              故成功 200+code=0、错误回真实 HTTP。
 * @Author Lou
 * @Date 2025/6/29
 */
@Slf4j
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ApiExceptionHandler {

    /** chat-common 业务异常:状态码取 error.httpStatus()。 */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Result<?>> handleApiException(ApiException ex) {
        ErrorCode error = ex.getError();
        log.warn("业务异常 code={} msg={}", error.code(), ex.getMessage());
        return ResponseEntity
                .status(error.httpStatus())
                .body(Result.error(error, ex.getMessage()));
    }

    /** 字段校验失败 -> 422 VALIDATION_FAILED,data=fieldErrors。 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<?>> handleValidException(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(fe ->
                fieldErrors.put(fe.getField(), fe.getDefaultMessage()));

        log.warn("字段校验失败: {}", fieldErrors);
        return ResponseEntity
                .status(CommonError.VALIDATION_FAILED.httpStatus())
                .body(Result.error(CommonError.VALIDATION_FAILED, "字段校验失败", fieldErrors));
    }

    /** 兜底 -> 500 INTERNAL(不泄内部细节)。 */
    @ExceptionHandler(Throwable.class)
    public ResponseEntity<Result<?>> handleThrowable(Throwable ex) {
        log.error("未知错误", ex);
        return ResponseEntity
                .status(CommonError.INTERNAL.httpStatus())
                .body(Result.error(CommonError.INTERNAL, "服务器内部错误"));
    }
}
