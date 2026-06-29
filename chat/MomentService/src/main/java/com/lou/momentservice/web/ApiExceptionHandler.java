package com.lou.momentservice.web;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;
import com.lou.common.api.ErrorCode;
import com.lou.common.api.FieldError;
import com.lou.common.api.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.ArrayList;
import java.util.List;

/**
 * @ClassName ApiExceptionHandler
 * @Description 统一异常 -> chat-common 包络 + 真实 HTTP 状态(03-contracts §2/§3)。
 *              形状参照 AuthenticationService.GlobalExceptionHandler。
 *              以 HIGHEST_PRECEDENCE 注册，优先于旧 {@code Exception.GlobalExceptionHandler}
 *              处理 ApiException / 字段校验 / 兜底,统一输出 {@link Result} 包络。
 * @Author Lou
 */
// item3:已停用——领域+ApiException 统一收口到 Exception/GlobalExceptionHandler(单一 advice,避免两 advice 冲突)。
@Slf4j
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
        List<FieldError> fieldErrors = new ArrayList<>();
        ex.getBindingResult().getFieldErrors().forEach(fe ->
                fieldErrors.add(new FieldError(fe.getField(), fe.getDefaultMessage())));

        log.warn("字段校验失败: {}", fieldErrors);
        return ResponseEntity
                .status(CommonError.VALIDATION_FAILED.httpStatus())
                .body(Result.error(CommonError.VALIDATION_FAILED, "字段校验失败", fieldErrors));
    }

    /** 兜底 -> 500 INTERNAL(不泄内部细节)。 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<?>> handleException(Exception ex) {
        log.error("未知错误", ex);
        return ResponseEntity
                .status(CommonError.INTERNAL.httpStatus())
                .body(Result.error(CommonError.INTERNAL, "服务器内部错误"));
    }
}
