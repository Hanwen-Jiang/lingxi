package com.lou.momentservice.data.getMomentList;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.util.Date;

@Data
@Accessors(chain = true)
public class MomentCommentVO implements Serializable {

    @JsonSerialize(using = ToStringSerializer.class)
    private Long momentId;

    @JsonSerialize(using = ToStringSerializer.class)
    private Long commentId;

    @JsonSerialize(using = ToStringSerializer.class)
    private Long userId;

    private String UserName;

    @JsonSerialize(using = ToStringSerializer.class)
    private Long parentCommentId;

    private String comment;

    private Date createTime;

    private Date updateTime;

}
