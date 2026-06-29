package com.lou.momentservice.data.getMomentList;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

@Data
@Accessors(chain = true)
public class MomentLikeVO implements Serializable {
    @JsonSerialize(using = ToStringSerializer.class)
    private Long likeId;

    @JsonSerialize(using = ToStringSerializer.class)
    private Long momentId;

    @JsonSerialize(using = ToStringSerializer.class)
    private Long userId;

    private String userName;

    private String userAvatar;
}
