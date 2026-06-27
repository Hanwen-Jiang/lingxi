package com.lou.messagingservice.web;

import com.lou.common.api.ApiException;
import com.lou.common.api.ErrorCode;
import com.lou.common.api.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * 仅处理 chat-common {@link ApiException} 的全局兜底，转成 {@link Result} + 真实 HTTP 状态。
 * <p>仅捕获 ApiException(新客户端端点抛出);旧端点抛 ResponseStatusException/ServiceException，
 * 不经此处，行为不变。
 */
@Slf4j
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Result<Void>> handleApiException(ApiException ex) {
        ErrorCode error = ex.getError();
        log.warn("ApiException: code={}, msg={}", error.code(), ex.getMessage());
        Result<Void> body = Result.error(error, ex.getMessage());
        return ResponseEntity.status(HttpStatus.valueOf(error.httpStatus())).body(body);
    }
}
