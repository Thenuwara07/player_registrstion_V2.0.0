import { Post, PostInput, SignUpResponse } from "../types/authTypes";
import { apiRequest, withoutEmptyStrings } from "./client";

// Author is set by the server from the signed-in admin
const postPayload = (post: PostInput) =>
  withoutEmptyStrings({
    title: post.title,
    subtitle: post.subtitle,
    content: post.content,
    imageName: post.imageName,
  });

export const createPost = (postData: PostInput): Promise<SignUpResponse> =>
  apiRequest("/admin/post", {
    method: "POST",
    body: postPayload(postData),
    errorMessage: "Failed to create post",
  });

// Public feed, newest first
export const GetPosts = async (): Promise<Post[]> => {
  const data = await apiRequest("/admin/posts", {
    errorMessage: "An error occurred while fetching the data.",
  });
  return data.data || data;
};

export const updatePost = (postData: PostInput): Promise<SignUpResponse> =>
  apiRequest(`/admin/post/${postData.id}`, {
    method: "PATCH",
    body: postPayload(postData),
    errorMessage: "Failed to update post",
  });

export const deletePost = (postId: number): Promise<SignUpResponse> =>
  apiRequest(`/admin/post/${postId}`, { method: "DELETE", errorMessage: "Failed to delete post" });

export const getPostCount = async (params?: {
  userId?: number | string;
  q?: string;
}): Promise<number> => {
  const query = new URLSearchParams();
  if (params?.userId !== undefined && params?.userId !== null) {
    query.set("userId", String(params.userId));
  }
  if (params?.q?.trim()) query.set("q", params.q.trim());

  const json = await apiRequest(`/admin/posts/count${query.toString() ? `?${query}` : ""}`, {
    errorMessage: "Failed to get post count",
  });
  return Number(json?.data?.count ?? 0);
};
