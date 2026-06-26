package com.lou.offlinedatastoreservice.data.offlineMessage;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

@Data
@Accessors(chain = true)
public class OfflineMsgBody implements Serializable {

    private String content;

    private String createdAt;

    private String replyId;

}
