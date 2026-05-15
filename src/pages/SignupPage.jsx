import { useState } from "react";
        localStorage.getItem("parking_signup_requests") || "[]"
      );

      existing.push(signupData);

      localStorage.setItem(
        "parking_signup_requests",
        JSON.stringify(existing)
      );

      setMessage("가입 신청이 완료되었습니다.");

      setTimeout(() => {
        navigate("/pending");
      }, 1000);
    } catch (err) {
      console.error(err);
      setMessage("가입 신청 실패");
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2>상가 회원가입 신청</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label>상가(건물)명</label>
          <br />
          <input
            type="text"
            value={buildingName}
            onChange={(e) => setBuildingName(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>호실</label>
          <br />
          <input
            type="text"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>로그인 아이디</label>
          <br />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>비밀번호</label>
          <br />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit">가입 신청</button>
      </form>

      {message && (
        <div style={{ marginTop: 16 }}>
          {message}
        </div>
      )}
    </div>
  );
}