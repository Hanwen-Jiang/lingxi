package com.lou.momentservice.data.getMomentList;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

@Data
@Accessors(chain = true)
public class LikeVO implements Serializable {

    private Long LikeId;

    private Long userId;

    private String userName;
}
