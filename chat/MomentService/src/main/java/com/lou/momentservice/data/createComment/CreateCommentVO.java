package com.lou.momentservice.data.createComment;

import lombok.Data;
import lombok.experimental.Accessors;

import java.io.Serializable;

@Data
@Accessors(chain = true)
public class CreateCommentVO implements Serializable {

    private Long parentCommentId;

    private String parentUserName;

    private Long commentId;

    private String userName;

    private String comment;
}
