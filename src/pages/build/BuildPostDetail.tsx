// 게시글 상세 페이지

import { useMemo, type FormEvent } from 'react';
import {
  BuildPostPresetBlock,
  formatDate,
  getAuthorLabel,
  getBuildPostContentParts,
  getCategoryLabel,
  sanitizeBuildPostHtml,
  type BuildComment,
  type BuildPost,
} from './buildShared';



// 답글용 ID 찾기
function getCommentById(comments: BuildComment[], commentId: string | null) {
  if (!commentId) return null;
  return comments.find((comment) => comment.id === commentId) ?? null;
}

// 답글이면 원본 ID 찾아옴
function getReplyMention(comment: BuildComment, comments: BuildComment[]) {
  const parentComment = getCommentById(comments, comment.parentCommentId);
  if (!parentComment) return '';
  return `@${getAuthorLabel(parentComment.userId, parentComment.authorNickname)}`;
}

// 본문 출력(HTML은 구별 및 태그 제거)
function BuildPostContent({ content }: { content: string }) {
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(content);
  const sanitizedContent = useMemo(() => (hasHtml ? sanitizeBuildPostHtml(content) : content), [content, hasHtml]);

  if (!sanitizedContent) return null;

  if (!hasHtml) {
    return <p className="build-detail-content">{sanitizedContent}</p>;
  }

  return <div className="build-detail-content" dangerouslySetInnerHTML={{ __html: sanitizedContent }} />;
}

// 게시글 데이터
export default function BuildPostDetail({
  canEdit,
  isAdmin,
  post,
  commentText,
  commentParentId,
  onCommentTextChange,
  onSetCommentParentId,
  onCreateComment,
  onAdminDeleteComment,
  onAdminDeletePost,
  onDeleteComment,
  onToggleLike,
  onToggleBookmark,
  onDeletePost,
  onEditPost,
  onReportPost,
}: {
  canEdit: boolean;
  isAdmin: boolean;
  post: BuildPost;
  commentText: string;
  commentParentId: string | null;
  onCommentTextChange: (value: string) => void;
  onSetCommentParentId: (commentId: string | null) => void;
  onCreateComment: (event: FormEvent<HTMLFormElement>) => void;
  onAdminDeleteComment: (comment: BuildComment) => void;
  onAdminDeletePost: (post: BuildPost) => void;
  onDeleteComment: (comment: BuildComment) => void;
  onToggleLike: (post: BuildPost) => void;
  onToggleBookmark: (post: BuildPost) => void;
  onDeletePost: (post: BuildPost) => void;
  onEditPost: (post: BuildPost) => void;
  onReportPost: (post: BuildPost) => void;
}) {
  // buildshared에서 가져온 함수로 내용과 프리셋 구분함
  const contentParts = useMemo(() => getBuildPostContentParts(post.content), [post.content]);
  // 답글 대상 찾기
  const replyTargetComment = getCommentById(post.comments, commentParentId);

  return (
    <article className="build-post-detail" aria-label="선택한 빌드 글">
      <div className="build-detail-heading">
        <div className="build-detail-title">
          <span className="build-category-badge">{getCategoryLabel(post.category)}</span>
          <h3>{post.title}</h3>
        </div>
        <div className="build-post-meta">
          <span>{getAuthorLabel(post.userId, post.authorNickname)}</span>
          <span>조회 {post.viewCount}</span>
          <span>추천 {post.likeCount}</span>
          <span>댓글 {post.comments.length}</span>
          <span>{formatDate(post.createdAt)}</span>
        </div>
        <div className="build-detail-tools">
          {canEdit ? (
            <button type="button" onClick={() => onEditPost(post)}>
              수정
            </button>
          ) : null}
          <button type="button" onClick={() => onToggleLike(post)}>
            {post.likedByMe ? '추천 취소' : '추천'} {post.likeCount}
          </button>
          <button type="button" onClick={() => onToggleBookmark(post)}>
            {post.bookmarkedByMe ? '북마크 해제' : '북마크'} {post.bookmarkCount}
          </button>
          <button type="button" onClick={() => onReportPost(post)}>
            신고
          </button>
          <button type="button" className="is-danger" onClick={() => onDeletePost(post)}>
            삭제
          </button>
          {isAdmin ? (
            <button type="button" className="is-danger" onClick={() => onAdminDeletePost(post)}>
              관리자 삭제
            </button>
          ) : null}
        </div>
      </div>
      {post.images.length ? (
        // 이미지 첨부
        <div className="build-image-grid">
          {post.images.map((image) => (
            <img key={`${image.id}-${image.imageUrl}`} src={image.imageUrl} alt={`${post.title} 이미지`} />
          ))}
        </div>
      ) : null}
      {/* 프리셋이 있으면 프리셋 출력 */}
      {contentParts.preset ? <BuildPostPresetBlock embeddedPreset={contentParts.preset} /> : null}
      <BuildPostContent content={contentParts.content} />

      {/* 댓글 */}
      <section className="build-comments" aria-label="댓글">
        <div className="build-comments-heading">
          <strong>댓글 {post.comments.length}</strong>
        </div>

        {post.comments.length ? (
          post.comments.map((comment) => {
            const replyMention = getReplyMention(comment, post.comments);

            return (
              <div key={comment.id} className={`build-comment${comment.parentCommentId ? ' is-reply' : ''}`}>
                <div>
                  <strong>{getAuthorLabel(comment.userId, comment.authorNickname)}</strong>
                  <span>{formatDate(comment.createdAt)}</span>
                </div>
                <p>
                  {replyMention ? <span className="build-reply-mention">{replyMention}</span> : null}
                  {comment.content}
                </p>
                <div className="build-comment-actions">
                  <button type="button" onClick={() => onSetCommentParentId(comment.id)}>
                    답글
                  </button>
                  <button type="button" className="is-danger" onClick={() => onDeleteComment(comment)}>
                    삭제
                  </button>
                  {isAdmin ? (
                    <button type="button" className="is-danger" onClick={() => onAdminDeleteComment(comment)}>
                      관리자 삭제
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        ) : (
          <p className="build-empty">아직 댓글이 없습니다.</p>
        )}

        <form className="build-comment-form" onSubmit={onCreateComment}>
          {commentParentId ? (
            <div className="build-reply-target">
              <span>
                답글 대상: {replyTargetComment ? `@${getAuthorLabel(replyTargetComment.userId, replyTargetComment.authorNickname)}` : `댓글 #${commentParentId}`}
              </span>
              <button type="button" onClick={() => onSetCommentParentId(null)}>
                취소
              </button>
            </div>
          ) : null}
          <textarea
            value={commentText}
            onChange={(event) => onCommentTextChange(event.target.value)}
            placeholder="댓글을 입력하세요."
            rows={3}
          />
          <button type="submit" className="build-secondary-button">
            댓글 등록
          </button>
        </form>
      </section>
    </article>
  );
}
