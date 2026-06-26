package com.lou.realtimecommunicationservice.excption;

/**
 * @ClassName BaseException
 * @Description TODO
 * @Author Lou
 * @Date 2025/6/10 16:14
 */


public class BaseException extends RuntimeException {
    public BaseException() {

    }

    public BaseException(String msg) {
        super(msg);
    }
}
