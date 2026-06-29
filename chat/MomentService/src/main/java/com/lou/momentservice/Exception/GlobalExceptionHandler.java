package com.lou.momentservice.Exception;

import com.lou.common.api.ApiException;
import com.lou.common.api.CommonError;
import com.lou.common.api.ErrorCode;
import com.lou.common.api.FieldError;
import com.lou.common.api.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

/**
 * 统一异常处理(item3 收口):全部返回 chat-common {@link Result} 包络 + §3 真实 HTTP 状态。
 * 唯一 advice(web/ApiExceptionHandler 已停用),领域异常按语义映射到真实 HTTP。
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

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Result<?>> handleValid(MethodArgumentNotValidException e) {
        List<FieldError> fieldErrors = new ArrayList<>();
        e.getBindingResult().getFieldErrors().forEach(fe ->
                fieldErrors.add(new FieldError(fe.getField(), fe.getDefaultMessage())));
        log.warn("字段校验失败: {}", fieldErrors);
        return ResponseEntity.status(CommonError.VALIDATION_FAILED.httpStatus())
                .body(Result.error(CommonError.VALIDATION_FAILED, "字段校验失败", fieldErrors));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Result<?>> handleRse(ResponseStatusException err) {
        HttpStatus status = err.getStatus();
        log.warn("请求被拒绝[{}]: {}", status.value(), err.getReason());
        CommonError mapped = status.is4xxClientError()
                ? (status == HttpStatus.FORBIDDEN ? CommonError.FORBIDDEN
                   : status == HttpStatus.NOT_FOUND ? CommonError.NOT_FOUND
                   : status == HttpStatus.UNAUTHORIZED ? CommonError.UNAUTHENTICATED
                   : CommonError.BAD_REQUEST)
                : CommonError.INTERNAL;
        return ResponseEntity.status(status).body(Result.error(mapped, err.getReason()));
    }

    // ---- 领域异常 → 真实 HTTP ----
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

    @ExceptionHandler(MomentException.class)
    public ResponseEntity<Result<?>> handleMoment(MomentException e) {
        log.warn("朋友圈操作异常: {}", e.getMessage());
        return of(CommonError.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(FileUploadException.class)
    public ResponseEntity<Result<?>> handleFileUpload(FileUploadException e) {
        log.warn("文件上传异常: {}", e.getMessage());
        return of(CommonError.BAD_REQUEST, e.getMessage());
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

    @ExceptionHandler(Throwable.class)
    public ResponseEntity<Result<?>> handleThrowable(Throwable err) {
        log.error("未知错误:", err);
        return of(CommonError.INTERNAL, "服务器内部错误");
    }
}
