package com.lou.offlinedatastoreservice.data.offlineMessage;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

@Data
@Accessors(chain = true)
public class OfflineMsgDetail implements Serializable {

    private String avatar;

    private OfflineMsgBody offlineMsgBody;

    private Integer type;

    private String userName;

    private String sendUserId;

    private String messageId;
}
