package com.lou.offlinedatastoreservice.data.offlineMessage;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.util.List;

@Data
@Accessors(chain = true)
public class OfflineMessage implements Serializable {

    private Long total;

    private String sessionId;

    private String sessionName;

    private String sessionAvatar;

    private Integer sessionType;

    private List<OfflineMsgDetail> offlineMsgDetails;

}
