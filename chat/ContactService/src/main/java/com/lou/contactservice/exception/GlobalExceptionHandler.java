package com.lou.contactservice.exception;

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
 * 统一异常处理(item3 收口):全部返回 chat-common {@link Result} 包络 + §3 真实 HTTP 状态。
 * 旧自有包络(200+体内 code)已停用——领域异常按语义映射到 CommonError 大类的真实 HTTP。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static ResponseEntity<Result<?>> of(ErrorCode e, String msg) {
        return ResponseEntity.status(e.httpStatus()).body(Result.error(e, msg));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Result<?>> handleApiException(ApiException ex) {
        ErrorCode error = ex.getError();
        log.warn("业务异常 code={} msg={}", error.code(), ex.getMessage());
        return of(error, ex.getMessage());
    }

    /** 字段校验失败 -> 422 VALIDATION_FAILED + data.fieldErrors。 */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<?>> handleValid(MethodArgumentNotValidException e) {
        List<FieldError> fieldErrors = new ArrayList<>();
        e.getBindingResult().getFieldErrors().forEach(fe ->
                fieldErrors.add(new FieldError(fe.getField(), fe.getDefaultMessage())));
        log.warn("字段校验失败: {}", fieldErrors);
        return ResponseEntity.status(CommonError.VALIDATION_FAILED.httpStatus())
                .body(Result.error(CommonError.VALIDATION_FAILED, "字段校验失败", fieldErrors));
    }

    // ---- 领域异常 → 真实 HTTP(原先恒 200+体内 code,本轮翻 §3 状态) ----
    @ExceptionHandler(UserException.class)
    public ResponseEntity<Result<?>> handleUser(UserException e) {
        log.warn("用户错误: {}", e.getMessage());
        return of(CommonError.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(CodeException.class)
    public ResponseEntity<Result<?>> handleCode(CodeException e) {
        log.warn("验证码错误: {}", e.getMessage());
        return of(CommonError.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<Result<?>> handleValidation(ValidationException e) {
        log.warn("数据验证异常: {}", e.getMessage());
        return of(CommonError.VALIDATION_FAILED, e.getMessage());
    }

    @ExceptionHandler(GroupException.class)
    public ResponseEntity<Result<?>> handleGroup(GroupException e) {
        log.warn("群组异常: {}", e.getMessage());
        return of(CommonError.CONFLICT, e.getMessage());
    }

    @ExceptionHandler(DatabaseException.class)
    public ResponseEntity<Result<?>> handleDb(DatabaseException e) {
        log.error("数据库错误: {}", e.getMessage());
        return of(CommonError.DEPENDENCY_UNAVAILABLE, "数据依赖暂不可用");
    }

    @ExceptionHandler(ServiceUnavailableException.class)
    public ResponseEntity<Result<?>> handleUnavailable(ServiceUnavailableException e) {
        log.error("依赖服务不可用: {}", e.getMessage());
        return of(CommonError.DEPENDENCY_UNAVAILABLE, "依赖服务暂不可用");
    }

    @ExceptionHandler(MessageSendFailureException.class)
    public ResponseEntity<Result<?>> handleSendFail(MessageSendFailureException ex) {
        log.error("消息发送失败, payload={}", ex.getRequestPayload(), ex);
        return of(CommonError.DEPENDENCY_UNAVAILABLE, "消息发送失败,请重试");
    }

    @ExceptionHandler(ServiceException.class)
    public ResponseEntity<Result<?>> handleService(ServiceException e) {
        log.error("服务异常: {}", e.getMessage());
        return of(CommonError.INTERNAL, "服务器内部错误");
    }

    /** 兜底 -> 500 INTERNAL(不泄内部细节)。 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<?>> handleException(Exception err) {
        log.error("未知错误:", err);
        return of(CommonError.INTERNAL, "服务器内部错误");
    }
}
