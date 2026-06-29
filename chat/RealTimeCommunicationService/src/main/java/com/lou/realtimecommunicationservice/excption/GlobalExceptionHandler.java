package com.lou.realtimecommunicationservice.excption;

import com.lou.realtimecommunicationservice.common.Result;
import lombok.extern.slf4j.Slf4j;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.HashMap;

/**
 * @ClassName GlobalExceptionHandler
 * @Description 旧自有包络异常处理(item3 收口后已停用,统一异常改由
 *              {@link com.lou.realtimecommunicationservice.web.ApiExceptionHandler}
 *              处理 chat-common 包络 + 真实 HTTP)。保留类以避免删除旧依赖,
 *              但移除 @RestControllerAdvice 使其不再生效。
 * @Author Lou
 * @Date 2025/5/30 15:55
 */

@Slf4j
public class GlobalExceptionHandler {

    @ExceptionHandler(value = Throwable.class)
    public Result<?> handleException(Throwable err) {
        log.error("未知错误", err);

        return Result.ServerError(err.getMessage());
    }

    @ExceptionHandler(value = MethodArgumentNotValidException.class)
    public Result<?> handleValidException(MethodArgumentNotValidException e) {
        BindingResult bindingResult = e.getBindingResult();
        HashMap<String, String> errorMap = new HashMap<>();
        bindingResult.getFieldErrors().forEach(fieldError -> {
            errorMap.put(fieldError.getField(), fieldError.getDefaultMessage());
        });

        log.error("数据校验出现问题{}, 错误信息为: {}", e.getMessage(), errorMap);

        return Result.ValidError(errorMap.toString());
    }
}
