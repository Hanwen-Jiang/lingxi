package com.lou.momentservice.data.getMomentList;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;
import java.util.Date;
import java.util.List;

@Data
@Accessors(chain = true)
public class MomentsVO implements Serializable {

    private Long momentId;

    private Long userId;

    private String userName;

    private String avatar;

    private String text;

    private List<String> mediaUrls;

    private List<LikeVO> likes;

    private List<MomentCommentVO> comments;

    private Date createTime;

    private Date updateTime;

    private Date deleteTime;
}
