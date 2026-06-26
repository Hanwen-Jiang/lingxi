package com.lou.offlinedatastoreservice.data.offlineMessage;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;

@EqualsAndHashCode(callSuper = true)
@Data
@AllArgsConstructor
public class OfflineRedPacketMsgBody extends OfflineMsgBody {
    private String redPacketWrapperText;
}
