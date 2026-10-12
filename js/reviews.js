const REVIEW_API_BASE = window.WEBFLIX_API_BASE ?? "https://inf2003-backend-161924392.asia-southeast1.run.app";
let reviewUserPromise;
let editingReviewId = null;
let reviewSubmitting = false;

function currentReviewUser() {
  if (!localStorage.getItem("token")) return Promise.resolve(null);
  if (!reviewUserPromise) {
    reviewUserPromise = fetch(`${REVIEW_API_BASE}/api/user/me`, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    }).then(response => response.ok ? response.json() : null).catch(() => null);
  }
  return reviewUserPromise;
}

function reviewMovieTitle() {
  const params = new URLSearchParams(window.location.search);
  return params.get("t") || params.get("title") || "";
}

function reviewStatus(message, error = false) {
  const target = document.getElementById("review-status");
  target.textContent = message;
  target.classList.toggle("text-danger", error);
}

function resetReviewEditor() {
  editingReviewId = null;
  document.getElementById("reviewForm").reset();
  document.getElementById("review-form-heading").textContent = "Leave a review";
  document.getElementById("review-submit").textContent = "Publish review";
  document.getElementById("review-cancel").hidden = true;
}

function editReview(review) {
  if (reviewSubmitting) return;
  editingReviewId = review.r_id;
  document.getElementById("rating").value = review.rating;
  document.getElementById("comment").value = review.comment;
  document.getElementById("review-form-heading").textContent = "Edit your review";
  document.getElementById("review-submit").textContent = "Save changes";
  document.getElementById("review-cancel").hidden = false;
  reviewStatus("");
  document.getElementById("reviewForm").scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("comment").focus();
}

async function reviewRequest(path, method, body) {
  const response = await fetch(REVIEW_API_BASE + path, {
    method,
    headers: { Authorization: "Bearer " + localStorage.getItem("token"), ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Log in again." : data.message || "Your review could not be saved.");
  return data;
}

async function deleteReview(review, button) {
  if (button.disabled || reviewSubmitting || !window.confirm("Delete your review?")) return;
  button.disabled = true;
  button.textContent = "Deleting...";
  try {
    await reviewRequest("/api/reviews/" + review.r_id, "DELETE");
    if (editingReviewId === review.r_id) resetReviewEditor();
    reviewStatus("Review deleted.");
    await loadReviews();
  } catch (error) {
    reviewStatus(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Delete";
  }
}

function renderReview(review, user) {
  const item = document.createElement("li");
  item.className = "review-entry";
  const meta = document.createElement("p");
  meta.className = "review-author";
  const date = new Date(review.created_at);
  meta.textContent = [review.author_name || (review.user_id ? "Former member" : "Legacy review"), date.toString() !== "Invalid Date" ? date.toLocaleDateString() : ""].filter(Boolean).join(" / ");
  const rating = document.createElement("p");
  rating.className = "review-rating";
  rating.textContent = review.rating + " / 5";
  const comment = document.createElement("p");
  comment.className = "review-comment";
  comment.textContent = review.comment;
  item.append(meta, rating, comment);
  if (user && review.user_id === user.id) {
    const actions = document.createElement("div");
    actions.className = "d-flex gap-2";
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn-outline-secondary btn-sm";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => editReview(review));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-outline-danger btn-sm";
    remove.textContent = "Delete";
    remove.addEventListener("click", () => deleteReview(review, remove));
    actions.append(edit, remove);
    item.append(actions);
  }
  return item;
}

async function loadReviews() {
  const list = document.getElementById("reviews-list");
  const title = reviewMovieTitle();
  if (!list || !title) return;
  try {
    const [response, user] = await Promise.all([
      fetch(`${REVIEW_API_BASE}/api/reviews?movieTitle=${encodeURIComponent(title)}`),
      currentReviewUser()
    ]);
    if (!response.ok) throw new Error("Reviews are unavailable. Try again.");
    const reviews = await response.json();
    if (reviews.length) list.replaceChildren(...reviews.map(review => renderReview(review, user)));
    else {
      const message = document.createElement("li");
      message.textContent = "No reviews yet. Be the first to share your perspective.";
      list.replaceChildren(message);
    }
  } catch (error) {
    const item = document.createElement("li");
    item.setAttribute("role", "alert");
    item.textContent = "Reviews could not be loaded. ";
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn btn-outline-secondary btn-sm";
    retry.textContent = "Try again";
    retry.addEventListener("click", loadReviews);
    item.append(retry);
    list.replaceChildren(item);
  }
}

async function hookReviewForm() {
  const form = document.getElementById("reviewForm");
  if (!form) return;
  form.hidden = true;
  const user = await currentReviewUser();
  const title = reviewMovieTitle();
  document.getElementById("review-login-prompt").hidden = !!user;
  if (!user) return;
  if (!title) { reviewStatus("Choose a movie before writing a review.", true); return; }
  form.hidden = false;
  document.getElementById("movieIdInput").value = title;
  document.getElementById("review-cancel").addEventListener("click", () => { if (!reviewSubmitting) { resetReviewEditor(); reviewStatus(""); } });
  form.addEventListener("submit", async event => {
    event.preventDefault();
    if (reviewSubmitting) return;
    const rating = Number(document.getElementById("rating").value);
    const comment = document.getElementById("comment").value.trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || !comment || comment.length > 5000) {
      reviewStatus("Choose a rating from 1 to 5 and write 1 to 5000 characters.", true);
      return;
    }
    reviewSubmitting = true;
    const submit = document.getElementById("review-submit");
    const cancel = document.getElementById("review-cancel");
    submit.disabled = true;
    cancel.disabled = true;
    submit.textContent = "Saving...";
    const editing = editingReviewId !== null;
    try {
      await reviewRequest(editing ? "/api/reviews/" + editingReviewId : "/api/reviews", editing ? "PATCH" : "POST", { movieTitle: title, rating, comment });
      resetReviewEditor();
      reviewStatus(editing ? "Review updated." : "Review published.");
      await loadReviews();
    } catch (error) {
      reviewStatus(error.message, true);
      submit.textContent = editing ? "Save changes" : "Publish review";
    } finally {
      reviewSubmitting = false;
      submit.disabled = false;
      cancel.disabled = false;
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  hookReviewForm();
  loadReviews();
});
