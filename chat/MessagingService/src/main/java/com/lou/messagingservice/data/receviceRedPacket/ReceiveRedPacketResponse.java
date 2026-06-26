package com.lou.messagingservice.data.receviceRedPacket;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.experimental.Accessors;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
@Accessors(chain = true)
public class ReceiveRedPacketResponse {

    private BigDecimal receivedAmount;

    private Integer status;
}
