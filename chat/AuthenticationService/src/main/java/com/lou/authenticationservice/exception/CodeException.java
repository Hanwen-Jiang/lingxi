package com.lou.authenticationservice.exception;

import com.lou.authenticationservice.constants.user.ErrorEnum;

/**
 * @ClassName CodeException
 * @Description TODO
 * @Author Lou
 * @Date 2025/5/30 16:22
 */

public class CodeException extends RuntimeException {

    private final int code;

    public CodeException(String message) {
        super(message);
        this.code = ErrorEnum.SUCCESS.getCode();
    }

    public CodeException(ErrorEnum errorEnum) {
        super(errorEnum.getMessage());
        this.code = errorEnum.getCode();
    }

    public CodeException(ErrorEnum errorEnum, String message) {
        super(message);

        this.code = errorEnum.getCode();
    }

    public int getCode() {
        return this.code;
    }
}

