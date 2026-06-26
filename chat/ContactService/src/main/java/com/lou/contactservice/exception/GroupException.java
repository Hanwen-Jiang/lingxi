package com.lou.contactservice.exception;

import com.lou.contactservice.constants.ErrorEnum;
import lombok.Getter;

@Getter
public class GroupException extends RuntimeException {
    private final int code;

    public GroupException(String message){
        super(message);

        this.code = ErrorEnum.SUCCESS.getCode();

    }

    public GroupException(ErrorEnum errorEnum){
        super(errorEnum.getMessage());

        this.code = errorEnum.getCode();

    }

    public GroupException(ErrorEnum errorEnum, String message){
        super(message);

        this.code = errorEnum.getCode();

    }

    public GroupException(int code, String message) {
        this.code = code;
    }
}
