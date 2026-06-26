package com.lou.realtimecommunicationservice.service;

import com.lou.realtimecommunicationservice.data.ReceiveMessage.ReceiveMessageRequest;
import com.lou.realtimecommunicationservice.data.ReceiveMessage.ReceiveMessageResponse;

public interface RcvMsgService {

    ReceiveMessageResponse receiveMessage(ReceiveMessageRequest request);
}
