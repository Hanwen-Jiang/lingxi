package com.lou.messagingservice.constants;

public class MessageOutboxStatus {

    public static final Integer INIT = 0;

    public static final Integer PENDING = 1;

    public static final Integer SENT = 2;

    public static final Integer FAILED = 3;

    private MessageOutboxStatus() {
    }
}
