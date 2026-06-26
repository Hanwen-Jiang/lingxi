package com.lou.messagingservice.model;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.util.Date;

@TableName(value = "message_outbox")
@Data
@Accessors(chain = true)
public class MessageOutbox implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long messageId;

    private String topic;

    private String messageKey;

    private String payload;

    private Integer status;

    private Integer retryCount;

    private Date nextRetryAt;

    private String lastError;

    private Date createdAt;

    private Date updatedAt;

    private static final long serialVersionUID = 1L;
}
