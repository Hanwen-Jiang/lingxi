package com.lou.realtimecommunicationservice.constants;

import lombok.Getter;

@Getter
public enum TimeOutEnum {
    TOKEN_TIME_OUT("token time out(day)",500000),
    JWT_TIME_OUT("token time out(day)",500000),
    CODE_TIME_OUT("code time out(minute)",500000);

    private String name;

    private int timeOut;

    TimeOutEnum(String name, int timeOut) {
        this.name = name;
        this.timeOut = timeOut;
    }

    public String getName() {
        return name;
    }

    public int getTimeOut() {
        return timeOut;
    }
}
