package com.lou.authenticationservice.exception;

import com.lou.authenticationservice.constants.user.ErrorEnum;

/**
 * @ClassName UserException
 * @Description TODO
 * @Author Lou
 * @Date 2025/5/30 16:00
 */


public class UserException extends RuntimeException {

    private final int code;

    public UserException(String message) {
        super(message);
        this.code = ErrorEnum.SUCCESS.getCode();
    }

    public UserException(ErrorEnum errorEnum) {
        super(errorEnum.getMessage());
        this.code = errorEnum.getCode();
    }

    public UserException(ErrorEnum errorEnum, String message) {
        super(message);

        this.code = errorEnum.getCode();
    }

    public int getCode() {
        return this.code;
    }
}
