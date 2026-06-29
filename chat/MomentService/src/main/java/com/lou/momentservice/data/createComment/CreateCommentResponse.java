package com.lou.momentservice.data.createComment;


import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import lombok.Data;
import lombok.experimental.Accessors;

@Data
@Accessors(chain = true)
public class CreateCommentResponse {

    @JsonSerialize(using = ToStringSerializer.class)
    private Long parentCommentId;

    private String parentUserName;

    @JsonSerialize(using = ToStringSerializer.class)
    private Long commentId;

    private String userName;

    private String comment;

}
