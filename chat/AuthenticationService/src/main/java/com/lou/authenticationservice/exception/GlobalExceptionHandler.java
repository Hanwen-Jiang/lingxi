package com.lou.authenticationservice.exception;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;
import com.lou.common.api.ErrorCode;
import com.lou.common.api.FieldError;
import com.lou.common.api.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.ArrayList;
import java.util.List;

/**
 * @ClassName GlobalExceptionHandler
 * @Description 统一异常 -> chat-common 包络 + 真实 HTTP 状态(03-contracts §2/§3)
 * @Author Lou
 * @Date 2025/5/30 15:55
 */

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

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

    /** 凭证错误 / 用户不存在 -> 401。 */
    @ExceptionHandler(UserException.class)
    public ResponseEntity<Result<?>> handleUserException(UserException ex) {
        log.warn("用户错误: {}", ex.getMessage());
        return ResponseEntity
                .status(CommonError.UNAUTHENTICATED.httpStatus())
                .body(Result.error(CommonError.UNAUTHENTICATED, ex.getMessage()));
    }

    /** 验证码错误 -> 400 BAD_REQUEST。 */
    @ExceptionHandler(CodeException.class)
    public ResponseEntity<Result<?>> handleCodeException(CodeException ex) {
        log.warn("验证码错误: {}", ex.getMessage());
        return ResponseEntity
                .status(CommonError.BAD_REQUEST.httpStatus())
                .body(Result.error(CommonError.BAD_REQUEST, ex.getMessage()));
    }

    /** 数据库 / 依赖异常 -> 503 DEPENDENCY_UNAVAILABLE(不泄内部细节)。 */
    @ExceptionHandler(DatabaseException.class)
    public ResponseEntity<Result<?>> handleDatabaseException(DatabaseException ex) {
        log.error("数据库错误: {}", ex.getMessage());
        return ResponseEntity
                .status(CommonError.DEPENDENCY_UNAVAILABLE.httpStatus())
                .body(Result.error(CommonError.DEPENDENCY_UNAVAILABLE, "服务暂不可用，请稍后重试"));
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
