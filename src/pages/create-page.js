export default function homePage({ app, navigate }) {
	app.innerHTML = `
		<section>
			<h1>Linpia</h1>
			<p>전시관 생성</p>
			<a href="/" data-link>돌아가기</a>
		</section>
	`;

	return () => {
		// 필요하면 cleanup
	};
}