package com.lou.realtimecommunicationservice.model;

import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class PendingAckMessage {

    private String ackId;

    private String receiveUserId;

    private String frameText;

    private int retryCount;

    private long lastSendTime;
}
