package com.lou.offlinedatastoreservice.data.offlineMessage;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.util.List;

@Data
@Accessors(chain = true)
public class OfflineMsgResponse implements Serializable {

    private List<OfflineMessage> offlineMsg;
}
