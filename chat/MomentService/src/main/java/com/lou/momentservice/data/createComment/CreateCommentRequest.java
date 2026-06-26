package com.lou.momentservice.data.createComment;


import lombok.Data;
import lombok.experimental.Accessors;

import javax.validation.constraints.NotNull;

@Data
@Accessors(chain = true)
public class CreateCommentRequest {

    private Long momentId;

    private MomentCommentDTO momentCommentDTO;
}
