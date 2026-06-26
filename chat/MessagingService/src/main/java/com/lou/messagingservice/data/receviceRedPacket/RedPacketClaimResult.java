package com.lou.messagingservice.data.receviceRedPacket;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.math.BigDecimal;

@Data
@AllArgsConstructor
public class RedPacketClaimResult {

    private Integer code;

    private BigDecimal amount;

    public static RedPacketClaimResult received() {
        return new RedPacketClaimResult(-1, null);
    }

    public static RedPacketClaimResult empty() {
        return new RedPacketClaimResult(0, null);
    }

    public static RedPacketClaimResult success(BigDecimal amount) {
        return new RedPacketClaimResult(1, amount);
    }

    public boolean isReceived() {
        return Integer.valueOf(-1).equals(code);
    }

    public boolean isEmpty() {
        return Integer.valueOf(0).equals(code);
    }

    public boolean isSuccess() {
        return Integer.valueOf(1).equals(code);
    }
}
