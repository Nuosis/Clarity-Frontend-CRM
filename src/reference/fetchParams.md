# Update
JSONSetElement ( "" 
	;["layout";"devTasks";JSONString ]
	;["action";"update";JSONString ]
	;["recordId";"9";JSONString ]
	;["fieldData";JSONSetElement ( "" 
		;["f_completed";"1";JSONNumber ]
	);JSONObject ]
)

# Find
JSONSetElement ( "" 
	;["layout";"devTasks";JSONString ]
	;["action";"read";JSONString ]
	;["query";JSONSetElement ( "" 
		;["f_active";"1";JSONNumber ]
	);JSONObject ]
)

# Create
JSONSetElement ( "" 
	;[ "layouts" ;"devTasks"; JSONString ]
	;[ "action" ;"create"; JSONString ] 
	;[ "version" ;"vLatest"; JSONString ]
	;[ "fieldData" ; 
		JSONSetElement ( "" 
			;["task";"\"Let's create a new log\"";JSONString ]
			;["type";"Test";JSONString ]
		)
	; JSONObject]
)

# Delete
JSONSetElement ( "" 
	;[ "layouts" ;"log"; JSONString ]
	;[ "action" ;"delete"; JSONString ] //read, metaData, create, update, delete, and duplicate
	;[ "version" ;"vLatest"; JSONString ]
	;[ "recordId" ; "3" ; JSONString ]
)
