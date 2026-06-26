package com.lou.momentservice.data.getMomentList;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

@Data
@Accessors(chain = true)
public class MomentLikeVO implements Serializable {
    private Long likeId;

    private Long momentId;

    private Long userId;

    private String userName;

    private String userAvatar;
}
